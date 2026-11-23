/**
 * Tokenized volunteer accept/decline links.
 *
 * Server-only. Raw tokens are emailed to volunteers; only their SHA-256 hash
 * is persisted. Redemption never trusts a request-supplied assignment id —
 * the assignment is resolved exclusively from the token row.
 */

import { createHash, randomBytes } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { isSentryEnabled } from '@/lib/sentry-enabled';
import type { AssignmentStatus } from '@/lib/types';

export type ResponseAction = 'confirmed' | 'declined';
export type ResponseActionInput = 'confirm' | 'decline';

export const RESPONSE_TOKEN_BYTES = 32;
export const RESPONSE_TOKEN_MIN_LENGTH = 20;
export const RESPONSE_TOKEN_MAX_LENGTH = 256;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TOKEN_AGE_MS = 14 * DAY_MS;
const MIN_TOKEN_AGE_MS = 60 * 60 * 1000; // 1 hour
const RESPONSE_TOKEN_RETRY_DELAY_MS = 250;

const INVALID_LINK_MESSAGE = 'This link is invalid or has expired.';

/**
 * Error thrown for any token problem. The message is intentionally generic so
 * callers never leak whether a token existed, expired, or was already used.
 */
export class ResponseTokenError extends Error {
  readonly code: 'invalid' | 'internal';

  constructor(code: 'invalid' | 'internal' = 'invalid', message = INVALID_LINK_MESSAGE) {
    super(message);
    this.name = 'ResponseTokenError';
    this.code = code;
  }
}

export function hashResponseToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function isPlausibleResponseToken(rawToken: unknown): rawToken is string {
  return (
    typeof rawToken === 'string' &&
    rawToken.length >= RESPONSE_TOKEN_MIN_LENGTH &&
    rawToken.length <= RESPONSE_TOKEN_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(rawToken)
  );
}

export function actionFromInput(input: ResponseActionInput): ResponseAction {
  return input === 'confirm' ? 'confirmed' : 'declined';
}

/**
 * Expiry for a new token: the end of the service date in UTC, capped at
 * 14 days from now, with a minimum lifetime of 1 hour.
 */
export function computeResponseTokenExpiry(serviceDate: string, now: Date = new Date()): Date {
  const maxExpiry = now.getTime() + MAX_TOKEN_AGE_MS;
  const minExpiry = now.getTime() + MIN_TOKEN_AGE_MS;

  const parsed = /^\d{4}-\d{2}-\d{2}/.test(serviceDate)
    ? Date.parse(`${serviceDate.slice(0, 10)}T00:00:00.000Z`)
    : NaN;

  // "End of the service date" = midnight UTC at the start of the next day.
  const endOfServiceDate = Number.isFinite(parsed) ? parsed + DAY_MS : maxExpiry;

  return new Date(Math.max(minExpiry, Math.min(endOfServiceDate, maxExpiry)));
}

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function buildResponseUrls(rawToken: string): { confirmUrl: string; declineUrl: string } {
  const base = appBaseUrl();
  const token = encodeURIComponent(rawToken);
  return {
    confirmUrl: `${base}/respond?t=${token}&a=confirm`,
    declineUrl: `${base}/respond?t=${token}&a=decline`,
  };
}

/**
 * Create a single-use token for an assignment. Several live tokens may exist
 * for the same assignment; each one can be redeemed only once.
 */
export async function createResponseToken(
  assignmentId: string,
  churchId: string,
  serviceDate: string,
  now: Date = new Date()
): Promise<string> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error('Supabase admin client is not configured');
  }

  const rawToken = randomBytes(RESPONSE_TOKEN_BYTES).toString('base64url');
  const expiresAt = computeResponseTokenExpiry(serviceDate, now);

  const { error } = await supabaseAdmin.from('assignment_response_tokens').insert({
    assignment_id: assignmentId,
    church_id: churchId,
    token_hash: hashResponseToken(rawToken),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error('Failed to create response token');
  }

  return rawToken;
}

function reportResponseTokenFailure(assignmentId: string, error: unknown): void {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!isSentryEnabled(dsn)) return;

  Sentry.captureException(error, {
    tags: { feature: 'assignment-response-token' },
    extra: { assignmentId },
  });
}

/**
 * Create a response token, retrying once after a short delay. If both attempts
 * fail the error is reported to Sentry (without tokens or PII) and rethrown so
 * callers can fall back or retry on their next run.
 */
export async function createResponseTokenWithRetry(
  assignmentId: string,
  churchId: string,
  serviceDate: string,
  now: Date = new Date()
): Promise<string> {
  try {
    return await createResponseToken(assignmentId, churchId, serviceDate, now);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_TOKEN_RETRY_DELAY_MS));

    try {
      return await createResponseToken(assignmentId, churchId, serviceDate, now);
    } catch (error) {
      reportResponseTokenFailure(assignmentId, error);
      throw error;
    }
  }
}

interface TokenRow {
  id: string;
  assignment_id: string;
  church_id: string;
  expires_at: string;
  used_at: string | null;
}

interface AssignmentWithService {
  id: string;
  role: string;
  service_id: string;
  status: AssignmentStatus;
  services?:
    | { id: string; title: string; date: string; church_id: string }
    | Array<{ id: string; title: string; date: string; church_id: string }>;
}

function singleService(services: AssignmentWithService['services']) {
  if (!services) return undefined;
  return Array.isArray(services) ? services[0] : services;
}

async function findTokenRow(rawToken: unknown): Promise<TokenRow | null> {
  if (!isPlausibleResponseToken(rawToken)) return null;

  const { data, error } = await supabaseAdmin
    .from('assignment_response_tokens')
    .select('id, assignment_id, church_id, expires_at, used_at')
    .eq('token_hash', hashResponseToken(rawToken))
    .maybeSingle();

  if (error) {
    throw new ResponseTokenError('internal', 'Unable to process this link right now.');
  }

  return (data as TokenRow | null) ?? null;
}

function isTokenUsable(row: TokenRow, now: Date): boolean {
  if (row.used_at) return false;
  return new Date(row.expires_at).getTime() > now.getTime();
}

async function loadAssignment(
  assignmentId: string,
  churchId: string
): Promise<AssignmentWithService | null> {
  const { data, error } = await supabaseAdmin
    .from('service_assignments')
    .select('id, role, service_id, status, services!inner(id, title, date, church_id)')
    .eq('id', assignmentId)
    .single();

  if (error || !data) return null;

  const assignment = data as AssignmentWithService;
  const service = singleService(assignment.services);
  if (!service || service.church_id !== churchId) return null;

  return assignment;
}

export interface ResponseTokenPreview {
  valid: boolean;
  status?: AssignmentStatus;
  serviceTitle?: string;
  serviceDate?: string;
  role?: string;
}

/**
 * Read-only preview used by GET so link scanners that prefetch links do not
 * consume the token. Never mutates a token or assignment.
 */
export async function previewResponseToken(
  rawToken: unknown,
  now: Date = new Date()
): Promise<ResponseTokenPreview> {
  const row = await findTokenRow(rawToken);
  if (!row || !isTokenUsable(row, now)) {
    return { valid: false };
  }

  const assignment = await loadAssignment(row.assignment_id, row.church_id);
  if (!assignment) {
    return { valid: false };
  }

  const service = singleService(assignment.services);
  if (!service) return { valid: false };

  return {
    valid: true,
    status: assignment.status,
    serviceTitle: service.title,
    serviceDate: service.date,
    role: assignment.role,
  };
}

export interface RedeemResponseTokenResult {
  status: ResponseAction;
  serviceId: string;
  serviceTitle: string;
  serviceDate: string;
  role: string;
}

/**
 * Redeem a token exactly once and apply the volunteer's response to its
 * assignment. Rejects missing, expired, or already-used tokens with a single
 * generic error.
 */
export async function redeemResponseToken(
  rawToken: unknown,
  action: ResponseAction,
  now: Date = new Date()
): Promise<RedeemResponseTokenResult> {
  if (!isSupabaseAdminConfigured()) {
    throw new ResponseTokenError('internal', 'Unable to process this link right now.');
  }

  const row = await findTokenRow(rawToken);
  if (!row || !isTokenUsable(row, now)) {
    throw new ResponseTokenError('invalid');
  }

  const assignment = await loadAssignment(row.assignment_id, row.church_id);
  if (!assignment) {
    throw new ResponseTokenError('invalid');
  }

  const service = singleService(assignment.services);
  if (!service) {
    throw new ResponseTokenError('invalid');
  }

  // Atomically claim the token: the `used_at IS NULL` guard makes concurrent
  // redemptions race to a single winner.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('assignment_response_tokens')
    .update({ used_at: now.toISOString(), used_action: action })
    .eq('id', row.id)
    .is('used_at', null)
    .select('id');

  if (claimError || !Array.isArray(claimed) || claimed.length !== 1) {
    throw new ResponseTokenError('invalid');
  }

  const { error: updateError } = await supabaseAdmin
    .from('service_assignments')
    .update({ status: action })
    .eq('id', row.assignment_id);

  if (updateError) {
    throw new ResponseTokenError('internal', 'Unable to update this assignment right now.');
  }

  return {
    status: action,
    serviceId: service.id,
    serviceTitle: service.title,
    serviceDate: service.date,
    role: assignment.role,
  };
}
