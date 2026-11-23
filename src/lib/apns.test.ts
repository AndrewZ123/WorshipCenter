import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  createApnsJwt,
  getApnsConfig,
  getMissingPushConfig,
  isPushEnabled,
  resetApnsJwtCache,
  sendApnsNotification,
} from './apns';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const testPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const APNS_ENV = {
  PUSH_ENABLED: 'true',
  APNS_KEY_ID: 'KEYID12345',
  APNS_TEAM_ID: 'TEAMID1234',
  APNS_BUNDLE_ID: 'com.worshipcenter.app',
  APNS_PRIVATE_KEY: testPem,
  APNS_PRODUCTION: 'false',
} as const;

function setEnv(values: Partial<Record<keyof typeof APNS_ENV, string>>) {
  for (const key of Object.keys(APNS_ENV) as Array<keyof typeof APNS_ENV>) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  setEnv({});
  resetApnsJwtCache();
});

afterEach(() => {
  setEnv({});
  resetApnsJwtCache();
});

describe('APNs configuration flag', () => {
  it('is disabled unless PUSH_ENABLED is exactly "true"', () => {
    process.env.PUSH_ENABLED = '1';
    expect(isPushEnabled()).toBe(false);
    process.env.PUSH_ENABLED = 'true';
    expect(isPushEnabled()).toBe(true);
  });

  it('reports every missing variable when nothing is configured', () => {
    expect(getMissingPushConfig()).toEqual([
      'PUSH_ENABLED',
      'APNS_KEY_ID',
      'APNS_TEAM_ID',
      'APNS_BUNDLE_ID',
      'APNS_PRIVATE_KEY',
      'APNS_PRODUCTION',
    ]);
    expect(getApnsConfig()).toBeNull();
  });

  it('returns null when the flag is on but credentials are incomplete', () => {
    setEnv({ ...APNS_ENV, APNS_PRIVATE_KEY: undefined });
    expect(getApnsConfig()).toBeNull();
    expect(getMissingPushConfig()).toContain('APNS_PRIVATE_KEY');
  });

  it('builds a production/sandbox config only when complete', () => {
    setEnv(APNS_ENV);
    const config = getApnsConfig();
    expect(config).toMatchObject({
      keyId: 'KEYID12345',
      teamId: 'TEAMID1234',
      bundleId: 'com.worshipcenter.app',
      production: false,
    });
    expect(config?.privateKey).toContain('BEGIN PRIVATE KEY');

    setEnv({ ...APNS_ENV, APNS_PRODUCTION: 'true' });
    expect(getApnsConfig()?.production).toBe(true);
  });

  it('does not send anything without config', async () => {
    const result = await sendApnsNotification('device-token', {
      title: 'Title',
      body: 'Body',
    });
    expect(result).toEqual({
      ok: false,
      status: 0,
      invalidToken: false,
      error: 'not_configured',
    });
  });
});

describe('APNs provider JWT', () => {
  it('has the ES256 header, kid and team issuer/issued-at claims', () => {
    const jwt = createApnsJwt(
      {
        keyId: 'KEYID12345',
        teamId: 'TEAMID1234',
        privateKey: testPem,
      },
      1_700_000_000
    );

    const [encodedHeader, encodedClaims, encodedSignature] = jwt.split('.');
    expect(encodedHeader).toBeTruthy();
    expect(encodedClaims).toBeTruthy();
    expect(encodedSignature).toBeTruthy();

    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));

    // Apple requires exactly these header keys (no typ/alg changes).
    expect(header).toEqual({ alg: 'ES256', kid: 'KEYID12345' });
    expect(claims).toEqual({ iss: 'TEAMID1234', iat: 1_700_000_000 });

    const valid = verify(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      { key: testPem, dsaEncoding: 'ieee-p1363' },
      Buffer.from(encodedSignature, 'base64url')
    );
    expect(valid).toBe(true);
  });

  it('rejects a malformed private key without throwing from the sender', async () => {
    setEnv({ ...APNS_ENV, APNS_PRIVATE_KEY: 'not-a-pem-key' });
    resetApnsJwtCache();

    const result = await sendApnsNotification('device-token', {
      title: 'Title',
      body: 'Body',
    });

    expect(result.ok).toBe(false);
    expect(result.invalidToken).toBe(false);
  });
});
