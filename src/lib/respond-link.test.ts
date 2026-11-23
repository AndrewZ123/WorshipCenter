import { describe, expect, it } from 'vitest';
import {
  applyPreviewFailure,
  applyPreviewResult,
  applySubmitFailure,
  applySubmitResult,
  emptyRespondState,
  initialRespondState,
  INVALID_LINK_MESSAGE,
  isPlausibleResponseToken,
  NETWORK_ERROR_MESSAGE,
  RESPONSE_TOKEN_MAX_LENGTH,
  RESPONSE_TOKEN_MIN_LENGTH,
} from './respond-link';

const validToken = 'a'.repeat(43);

describe('respond link token validation', () => {
  it('rejects a missing token without entering loading', () => {
    const state = initialRespondState('');

    expect(state.phase).toBe('invalid');
    expect(state.preview).toBeNull();
  });

  it('rejects malformed tokens synchronously', () => {
    for (const token of ['short', 'a'.repeat(RESPONSE_TOKEN_MIN_LENGTH - 1), 'bad token!', 'a'.repeat(RESPONSE_TOKEN_MAX_LENGTH + 1)]) {
      expect(isPlausibleResponseToken(token)).toBe(false);
      expect(initialRespondState(token).phase).toBe('invalid');
    }
  });

  it('starts loading for a well-formed token', () => {
    expect(isPlausibleResponseToken(validToken)).toBe(true);
    expect(initialRespondState(validToken).phase).toBe('loading');
  });
});

describe('respond preview state', () => {
  it('treats a valid:false preview as an invalid link', () => {
    const state = applyPreviewResult(initialRespondState(validToken), {
      ok: true,
      status: 200,
      data: { valid: false },
    });

    expect(state.phase).toBe('invalid');
    expect(state.error).toBe('');
  });

  it('treats an HTTP error preview as an invalid link', () => {
    const state = applyPreviewResult(initialRespondState(validToken), {
      ok: false,
      status: 500,
      data: {},
    });

    expect(state.phase).toBe('invalid');
  });

  it('shows the pending assignment preview', () => {
    const state = applyPreviewResult(initialRespondState(validToken), {
      ok: true,
      status: 200,
      data: {
        valid: true,
        status: 'pending',
        serviceTitle: 'Sunday Worship',
        serviceDate: '2026-12-04',
        role: 'vocals',
      },
    });

    expect(state.phase).toBe('ready');
    expect(state.preview).toMatchObject({
      status: 'pending',
      serviceTitle: 'Sunday Worship',
      serviceDate: '2026-12-04',
      role: 'vocals',
    });
  });

  it('ends loading with a retry state on a network failure', () => {
    const state = applyPreviewFailure();

    expect(state.phase).toBe('network_error');
    expect(state.error).toBe(NETWORK_ERROR_MESSAGE);
    expect(state.phase).not.toBe('loading');
  });
});

describe('respond submit state', () => {
  const ready = applyPreviewResult(initialRespondState(validToken), {
    ok: true,
    status: 200,
    data: { valid: true, status: 'pending', serviceTitle: 'Sunday Worship' },
  });

  it('records a successful confirmation', () => {
    const state = applySubmitResult(ready, {
      ok: true,
      status: 200,
      data: { ok: true, status: 'confirmed' },
    });

    expect(state.phase).toBe('done');
    expect(state.respondedStatus).toBe('confirmed');
  });

  it('records a successful decline', () => {
    const state = applySubmitResult(ready, {
      ok: true,
      status: 200,
      data: { ok: true, status: 'declined' },
    });

    expect(state.phase).toBe('done');
    expect(state.respondedStatus).toBe('declined');
  });

  it('turns an already-used token (410) into the invalid link state', () => {
    const state = applySubmitResult(ready, {
      ok: false,
      status: 410,
      data: { ok: false, error: 'This link is invalid or has expired.' },
    });

    expect(state.phase).toBe('invalid');
    expect(state.error).toBe('');
    expect(INVALID_LINK_MESSAGE).toContain('Ask your team leader to resend it');
  });

  it('keeps the assignment visible and shows the server error for other failures', () => {
    const state = applySubmitResult(ready, {
      ok: false,
      status: 500,
      data: { ok: false, error: 'Unable to process this link right now.' },
    });

    expect(state.phase).toBe('ready');
    expect(state.error).toBe('Unable to process this link right now.');
    expect(state.preview?.serviceTitle).toBe('Sunday Worship');
  });

  it('ends loading with a retryable message on a submit network failure', () => {
    const state = applySubmitFailure(ready);

    expect(state.phase).toBe('ready');
    expect(state.error).toBeTruthy();
  });
});

describe('respond state never stays loading', () => {
  it('every terminal transition leaves the loading phase', () => {
    const states = [
      emptyRespondState('invalid'),
      initialRespondState(''),
      initialRespondState(validToken),
      applyPreviewResult(initialRespondState(validToken), {
        ok: true,
        status: 200,
        data: { valid: false },
      }),
      applyPreviewFailure(),
      applySubmitResult(initialRespondState(validToken), {
        ok: true,
        status: 200,
        data: { ok: true, status: 'confirmed' },
      }),
    ];

    // Only the initial well-formed token intentionally waits for the fetch.
    expect(states.slice(0, 2).every((state) => state.phase !== 'loading')).toBe(true);
    expect(states[2].phase).toBe('loading');
    expect(states.slice(3).every((state) => state.phase !== 'loading')).toBe(true);
  });
});
