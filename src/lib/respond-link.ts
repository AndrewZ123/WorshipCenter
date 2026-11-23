/**
 * Pure state helpers for the public /respond page.
 *
 * The page must resolve to a friendly invalid/retry state without ever
 * requiring a session. Token validation and the preview/submit state
 * transitions live here so they can be unit tested without a browser.
 */

export const RESPONSE_TOKEN_MIN_LENGTH = 20;
export const RESPONSE_TOKEN_MAX_LENGTH = 256;

export type RespondAction = 'confirm' | 'decline';

export interface RespondPreview {
  valid: boolean;
  status?: string;
  serviceTitle?: string;
  serviceDate?: string;
  role?: string;
}

export type RespondPhase = 'loading' | 'ready' | 'invalid' | 'network_error' | 'done';

export interface RespondState {
  phase: RespondPhase;
  preview: RespondPreview | null;
  respondedStatus: 'confirmed' | 'declined' | null;
  error: string;
}

export interface RespondResult {
  ok: boolean;
  status: number;
  data: unknown;
}

export const INVALID_LINK_MESSAGE =
  'This link is invalid or has expired. Ask your team leader to resend it, or sign in to respond.';
export const NETWORK_ERROR_MESSAGE =
  'Unable to load this link. Check your connection and try again.';
export const SUBMIT_NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Please try again.';

export function isPlausibleResponseToken(rawToken: unknown): rawToken is string {
  return (
    typeof rawToken === 'string' &&
    rawToken.length >= RESPONSE_TOKEN_MIN_LENGTH &&
    rawToken.length <= RESPONSE_TOKEN_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(rawToken)
  );
}

export function emptyRespondState(phase: RespondPhase = 'loading'): RespondState {
  return {
    phase,
    preview: null,
    respondedStatus: null,
    error: '',
  };
}

/**
 * No token and malformed tokens are rejected synchronously, so the page does
 * not fetch (or show a spinner) for a link that can never be valid.
 */
export function initialRespondState(token: string | null | undefined): RespondState {
  if (!isPlausibleResponseToken(token)) {
    return emptyRespondState('invalid');
  }
  return emptyRespondState('loading');
}

function readRespondData(data: unknown): (RespondPreview & { ok?: boolean; error?: unknown }) | null {
  if (!data || typeof data !== 'object') return null;
  return data as RespondPreview & { ok?: boolean; error?: unknown };
}

export function applyPreviewResult(state: RespondState, result: RespondResult): RespondState {
  const data = readRespondData(result.data);
  if (result.ok && data?.valid === true) {
    return {
      ...state,
      phase: 'ready',
      preview: data,
      error: '',
    };
  }
  return emptyRespondState('invalid');
}

export function applyPreviewFailure(): RespondState {
  return {
    ...emptyRespondState('network_error'),
    error: NETWORK_ERROR_MESSAGE,
  };
}

export function applySubmitResult(state: RespondState, result: RespondResult): RespondState {
  const data = readRespondData(result.data);

  if (result.ok && data?.ok === true) {
    return {
      ...state,
      phase: 'done',
      respondedStatus: data.status === 'declined' ? 'declined' : 'confirmed',
      error: '',
    };
  }

  if (result.status === 410) {
    return emptyRespondState('invalid');
  }

  return {
    ...state,
    phase: 'ready',
    error:
      (typeof data?.error === 'string' ? data.error : '') ||
      'Something went wrong. Please try again.',
  };
}

export function applySubmitFailure(state: RespondState): RespondState {
  return {
    ...state,
    phase: 'ready',
    error: SUBMIT_NETWORK_ERROR_MESSAGE,
  };
}
