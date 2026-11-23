/**
 * Client-side trigger for server push events.
 *
 * Several writes happen directly from the browser with Supabase RLS
 * (assignment creation, service date/time edits, chat messages). After those
 * writes succeed, the client asks the server to emit the corresponding APNs
 * notification. The server re-reads the record, checks church ownership, and
 * no-ops unless push is configured.
 */

import { apiUrl, getAuthHeaders } from '@/lib/api-base';

export type PushEvent =
  | { type: 'assignment_created'; assignmentId: string }
  | { type: 'schedule_changed'; serviceId: string }
  | { type: 'mention'; messageId: string; kind: 'channel' | 'service' };

export async function notifyPushEvent(event: PushEvent): Promise<void> {
  try {
    await fetch(apiUrl('/api/push/events'), {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(event),
    });
  } catch {
    // Push is best-effort; never surface trigger failures to the user.
  }
}
