/**
 * APNs (Apple Push Notification service) provider.
 *
 * Uses token-based (ES256 JWT) authentication over HTTP/2 with Node built-ins
 * only — no Firebase, no paid push service. Everything here fails closed: when
 * the feature flag or any required environment variable is missing, callers get
 * a no-op result instead of an exception.
 */

import crypto from 'node:crypto';
import http2 from 'node:http2';

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  production: boolean;
}

export interface ApnsPushPayload {
  title: string;
  body: string;
  badge?: number;
  /** Deep link exposed to the app as `notification.data.url`. */
  url?: string;
}

export interface ApnsSendResult {
  ok: boolean;
  status: number;
  reason?: string;
  /** APNs says this device token is no longer valid (410 / BadDeviceToken / Unregistered). */
  invalidToken: boolean;
  error?: string;
}

const REQUIRED_APNS_VARS = [
  'APNS_KEY_ID',
  'APNS_TEAM_ID',
  'APNS_BUNDLE_ID',
  'APNS_PRIVATE_KEY',
] as const;

const APNS_TIMEOUT_MS = 10_000;
// Apple accepts tokens for up to 60 minutes; refresh a little early.
const JWT_TTL_MS = 50 * 60 * 1000;

let cachedJwt: { jwt: string; cacheKey: string; expiresAt: number } | null = null;

export function isPushEnabled(): boolean {
  return process.env.PUSH_ENABLED === 'true';
}

/**
 * Names of environment variables that are still required before APNs can send.
 * The feature flag is included so operators can see the complete setup gap.
 */
export function getMissingPushConfig(): string[] {
  const missing: string[] = [];

  if (!isPushEnabled()) missing.push('PUSH_ENABLED');

  for (const name of REQUIRED_APNS_VARS) {
    if (!process.env[name]) missing.push(name);
  }

  const production = process.env.APNS_PRODUCTION;
  if (production !== 'true' && production !== 'false') {
    missing.push('APNS_PRODUCTION');
  }

  return missing;
}

function normalizePrivateKey(value: string): string {
  // Vercel/other hosts commonly store PEM contents with literal \n escapes.
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

/**
 * Returns a usable APNs configuration, or null when the flag/config are not
 * complete. Never logs or returns the private key.
 */
export function getApnsConfig(): ApnsConfig | null {
  if (getMissingPushConfig().length > 0) return null;

  return {
    keyId: process.env.APNS_KEY_ID as string,
    teamId: process.env.APNS_TEAM_ID as string,
    bundleId: process.env.APNS_BUNDLE_ID as string,
    privateKey: normalizePrivateKey(process.env.APNS_PRIVATE_KEY as string),
    production: process.env.APNS_PRODUCTION === 'true',
  };
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * Builds the provider JWT Apple expects: ES256, with `kid` in the header and
 * the team id as `iss`. Exported for tests and so the shape is verifiable.
 */
export function createApnsJwt(
  config: Pick<ApnsConfig, 'keyId' | 'teamId' | 'privateKey'>,
  issuedAtSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const header = { alg: 'ES256', kid: config.keyId };
  const claims = { iss: config.teamId, iat: issuedAtSeconds };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${base64Url(signature)}`;
}

function getCachedJwt(config: ApnsConfig): string {
  const cacheKey = `${config.keyId}:${config.teamId}`;
  const now = Date.now();

  if (cachedJwt && cachedJwt.cacheKey === cacheKey && cachedJwt.expiresAt > now) {
    return cachedJwt.jwt;
  }

  const jwt = createApnsJwt(config);
  cachedJwt = { jwt, cacheKey, expiresAt: now + JWT_TTL_MS };
  return jwt;
}

/** Test helper — clears the in-memory provider JWT. */
export function resetApnsJwtCache(): void {
  cachedJwt = null;
}

function buildPayload(payload: ApnsPushPayload): string {
  const aps: Record<string, unknown> = {
    alert: { title: payload.title, body: payload.body },
    sound: 'default',
  };
  if (typeof payload.badge === 'number' && Number.isFinite(payload.badge)) {
    aps.badge = Math.max(0, Math.trunc(payload.badge));
  }

  // Custom keys live at the top level of the APNs payload; Capacitor exposes
  // them to JS as `notification.data.url`.
  return JSON.stringify(payload.url ? { aps, url: payload.url } : { aps });
}

function isInvalidTokenResponse(status: number, reason?: string): boolean {
  return (
    status === 410 ||
    reason === 'BadDeviceToken' ||
    reason === 'Unregistered'
  );
}

/**
 * Sends one alert to one device token. Resolves for every outcome — it never
 * rejects, so background callers can fire-and-forget safely.
 */
export async function sendApnsNotification(
  token: string,
  payload: ApnsPushPayload,
  config: ApnsConfig | null = getApnsConfig()
): Promise<ApnsSendResult> {
  if (!config) {
    return { ok: false, status: 0, invalidToken: false, error: 'not_configured' };
  }

  const origin = config.production
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  let body: string;
  let authorization: string;
  try {
    body = buildPayload(payload);
    authorization = `bearer ${getCachedJwt(config)}`;
  } catch (error) {
    return {
      ok: false,
      status: 0,
      invalidToken: false,
      error: error instanceof Error ? error.message : 'jwt_failed',
    };
  }

  return new Promise<ApnsSendResult>((resolve) => {
    let settled = false;
    let client: http2.ClientHttp2Session | null = null;

    const finish = (result: ApnsSendResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client?.close();
      } catch {
        // Session may already be destroyed.
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, status: 0, invalidToken: false, error: 'timeout' });
    }, APNS_TIMEOUT_MS);

    try {
      client = http2.connect(origin);
    } catch (error) {
      finish({
        ok: false,
        status: 0,
        invalidToken: false,
        error: error instanceof Error ? error.message : 'connect_failed',
      });
      return;
    }

    client.on('error', (error) => {
      finish({ ok: false, status: 0, invalidToken: false, error: error.message });
    });

    let request: http2.ClientHttp2Stream;
    try {
      request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${encodeURIComponent(token)}`,
        authorization,
        'apns-topic': config.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });
    } catch (error) {
      finish({
        ok: false,
        status: 0,
        invalidToken: false,
        error: error instanceof Error ? error.message : 'request_failed',
      });
      return;
    }

    request.setEncoding('utf8');
    request.setTimeout(APNS_TIMEOUT_MS, () => {
      try {
        request.close(http2.constants.NGHTTP2_CANCEL);
      } catch {
        // Ignore: the overall timeout will settle the promise.
      }
    });

    let status = 0;
    let rawBody = '';

    request.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    request.on('data', (chunk: string) => {
      rawBody += chunk;
    });
    request.on('error', (error) => {
      finish({ ok: false, status, invalidToken: false, error: error.message });
    });
    request.on('end', () => {
      if (status === 200) {
        finish({ ok: true, status, invalidToken: false });
        return;
      }

      let reason: string | undefined;
      try {
        const parsed = JSON.parse(rawBody) as { reason?: unknown };
        if (typeof parsed.reason === 'string') reason = parsed.reason;
      } catch {
        // APNs normally returns JSON, but don't fail if it doesn't.
      }

      finish({
        ok: false,
        status,
        reason,
        invalidToken: isInvalidTokenResponse(status, reason),
        error: reason || `apns_${status || 'error'}`,
      });
    });

    request.end(body);
  });
}
