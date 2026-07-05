import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import type { LiveStateMessage } from '@/lib/types';

// ─── Channel helpers ──────────────────────────────────────────────────

function channelName(serviceId: string) {
  return `service-live:${serviceId}`;
}

// ─── Heartbeat / timeout constants ────────────────────────────────────

export const CONTROLLER_TIMEOUT_MS = 10_000;

// ─── Controller (publisher) ───────────────────────────────────────────

export function createControllerChannel(serviceId: string) {
  const name = channelName(serviceId);
  const channel = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });

  channel.subscribe((status) => {
    const s = String(status);
    if (s === 'SUBSCRIBED') {
      console.log(`[LiveSync] Controller subscribed to ${name}`);
    } else if (s === 'SUBSCRIPTION_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
      console.warn(`[LiveSync] Controller channel ${name} status: ${s}`);
    }
  });

  return channel;
}

export function publishState(
  channel: ReturnType<typeof supabase.channel>,
  sessionId: string,
  state: {
    currentIndex: number;
    currentItemId: string | null;
    elapsedMs: number;
    isPaused: boolean;
  },
) {
  const msg: LiveStateMessage = {
    type: 'state_update',
    sessionId,
    currentIndex: state.currentIndex,
    currentItemId: state.currentItemId,
    elapsedMs: state.elapsedMs,
    isPaused: state.isPaused,
    timestamp: Date.now(),
  };

  channel.send({
    type: 'broadcast',
    event: 'live_state',
    payload: msg,
  });
}

export function publishEndSession(
  channel: ReturnType<typeof supabase.channel>,
  sessionId: string,
) {
  const msg: LiveStateMessage = {
    type: 'service_ended',
    sessionId,
    timestamp: Date.now(),
  };

  channel.send({
    type: 'broadcast',
    event: 'live_state',
    payload: msg,
  });
}

// ─── Viewer (subscriber) ──────────────────────────────────────────────

export interface LiveStateHandler {
  onState: (state: {
    currentIndex: number;
    currentItemId: string | null;
    elapsedMs: number;
    isPaused: boolean;
    timestamp: number;
  }) => void;
  onEnd: () => void;
  onTimeout: () => void;
}

export function createViewerChannel(
  serviceId: string,
  handlers: LiveStateHandler,
) {
  const name = channelName(serviceId);
  let lastHeartbeat = Date.now();
  let timeoutTimer: ReturnType<typeof setInterval> | null = null;

  const channel = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'live_state' }, (payload) => {
      const msg = payload.payload as LiveStateMessage;
      lastHeartbeat = Date.now();

      if (msg.type === 'state_update') {
        handlers.onState({
          currentIndex: msg.currentIndex ?? 0,
          currentItemId: msg.currentItemId ?? null,
          elapsedMs: msg.elapsedMs ?? 0,
          isPaused: msg.isPaused ?? true,
          timestamp: msg.timestamp,
        });
      } else if (msg.type === 'service_ended') {
        stopTimeoutChecker();
        handlers.onEnd();
      }
    })
    .subscribe((status) => {
      const s = String(status);
      if (s === 'SUBSCRIBED') {
        console.log(`[LiveSync] Viewer subscribed to ${name}`);
        lastHeartbeat = Date.now();
        startTimeoutChecker();
      } else if (s === 'SUBSCRIPTION_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        console.warn(`[LiveSync] Viewer channel ${name} status: ${s}`);
      }
    });

  function startTimeoutChecker() {
    stopTimeoutChecker();
    timeoutTimer = setInterval(() => {
      if (Date.now() - lastHeartbeat > CONTROLLER_TIMEOUT_MS) {
        handlers.onTimeout();
      }
    }, 2000);
  }

  function stopTimeoutChecker() {
    if (timeoutTimer !== null) {
      clearInterval(timeoutTimer);
      timeoutTimer = null;
    }
  }

  return {
    unsubscribe: () => {
      stopTimeoutChecker();
      supabase.removeChannel(channel);
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

export async function getActiveSession(serviceId: string, churchId: string) {
  return db.serviceLive.getActiveSession(serviceId, churchId);
}

export async function startLiveSession(
  serviceId: string,
  churchId: string,
  userId: string,
  currentItemId?: string,
  currentIndex?: number,
) {
  // End any other live sessions for this service first
  await db.serviceLive.endActiveSessions(serviceId, churchId);
  // Start new session
  return db.serviceLive.startSession(serviceId, churchId, userId, currentItemId, currentIndex);
}
