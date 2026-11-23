/**
 * Pure helpers for server-side push triggers. Kept separate from the route so
 * the mention parser and message truncation are easy to test.
 */

export interface MentionUser {
  id: string;
  name: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds users mentioned with `@Name` / `@First Last` in a chat message.
 *
 * Full names always match. A first name only matches when it is unique in the
 * church, so two members named "John Smith" and "John Doe" still need their
 * full name to avoid notifying both.
 */
export function findMentionedUserIds(content: string, users: MentionUser[]): string[] {
  if (!content) return [];

  const firstNameCounts = new Map<string, number>();
  for (const user of users) {
    const first = (user.name || '').trim().split(/\s+/)[0]?.toLowerCase();
    if (!first) continue;
    firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  }

  const mentioned = new Set<string>();

  for (const user of users) {
    const fullName = (user.name || '').trim();
    if (!fullName) continue;

    const candidates = new Set<string>([fullName]);
    const firstName = fullName.split(/\s+/)[0];
    if (
      firstName &&
      firstName !== fullName &&
      firstName.length >= 2 &&
      firstNameCounts.get(firstName.toLowerCase()) === 1
    ) {
      candidates.add(firstName);
    }

    for (const candidate of candidates) {
      const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(candidate)}(?=$|[^\\p{L}\\p{N}_])`,
        'iu'
      );
      if (pattern.test(content)) {
        mentioned.add(user.id);
        break;
      }
    }
  }

  return [...mentioned];
}

/** Trims a message body to at most `max` characters, including the ellipsis. */
export function truncatePushBody(text: string, max = 120): string {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function formatPushDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function assignmentCreatedPush(input: {
  role: string;
  serviceTitle: string;
  serviceDate: string;
  serviceId: string;
}): { title: string; body: string; data: Record<string, string> } {
  const role = input.role || 'team member';
  return {
    title: 'New assignment',
    body: `You're scheduled: ${role} for ${input.serviceTitle} on ${formatPushDate(input.serviceDate)}`,
    data: { url: `/services/${input.serviceId}` },
  };
}

export function assignmentRemovedPush(input: {
  serviceTitle: string;
  serviceDate: string;
  serviceId: string;
}): { title: string; body: string; data: Record<string, string> } {
  return {
    title: 'Schedule change',
    body: `You've been removed from ${input.serviceTitle} on ${formatPushDate(input.serviceDate)}`,
    data: { url: `/services/${input.serviceId}` },
  };
}

export function scheduleChangedPush(input: {
  serviceTitle: string;
  serviceDate: string;
  serviceTime: string;
  serviceId: string;
}): { title: string; body: string; data: Record<string, string> } {
  const time = input.serviceTime ? ` at ${input.serviceTime}` : '';
  return {
    title: 'Schedule change',
    body: `${input.serviceTitle} is now ${formatPushDate(input.serviceDate)}${time}`,
    data: { url: `/services/${input.serviceId}` },
  };
}

export function mentionPush(input: {
  senderName: string;
  message: string;
  label: string;
  url: string;
}): { title: string; body: string; data: Record<string, string> } {
  return {
    title: `Mentioned in ${input.label}`,
    body: truncatePushBody(`${input.senderName} mentioned you: ${input.message}`),
    data: { url: input.url },
  };
}
