import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { isPushConfigured, sendPushNotification } from '@/lib/push';
import {
  assignmentCreatedPush,
  findMentionedUserIds,
  mentionPush,
  scheduleChangedPush,
} from '@/lib/push-events';
import { supabaseAdmin } from '@/lib/supabase';
import { UUIDSchema, invalidInputResponse } from '@/lib/validation';

const PushEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('assignment_created'), assignmentId: UUIDSchema }),
  z.object({ type: z.literal('schedule_changed'), serviceId: UUIDSchema }),
  z.object({
    type: z.literal('mention'),
    messageId: UUIDSchema,
    kind: z.enum(['channel', 'service']),
  }),
]);

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface ServiceLookup {
  id: string;
  title: string;
  date: string;
  time: string | null;
  church_id: string;
}

interface MemberLookup {
  user_id: string | null;
  name?: string | null;
}

async function sendToUsers(
  userIds: Array<string | null | undefined>,
  payload: { title: string; body: string; data: Record<string, string> },
  excludeUserId?: string
): Promise<number> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  let notified = 0;

  await Promise.all(
    unique.map(async (userId) => {
      if (userId === excludeUserId) return;
      const result = await sendPushNotification(userId, payload);
      if (!result.skipped && result.sent > 0) notified += 1;
    })
  );

  return notified;
}

async function handleAssignmentCreated(userId: string, churchId: string, assignmentId: string) {
  const { data: assignment } = await supabaseAdmin
    .from('service_assignments')
    .select(
      'id, role, service_id, team_member_id, services(id, title, date, time, church_id), team_members(user_id, name)'
    )
    .eq('id', assignmentId)
    .maybeSingle();

  if (!assignment) return { status: 404, notified: 0 };

  const service = firstRow<ServiceLookup>(assignment.services);
  if (!service || service.church_id !== churchId) {
    return { status: 403, notified: 0 };
  }

  const member = firstRow<MemberLookup>(assignment.team_members);
  if (!member?.user_id) {
    return { status: 200, notified: 0 };
  }

  const payload = assignmentCreatedPush({
    role: assignment.role,
    serviceTitle: service.title,
    serviceDate: service.date,
    serviceId: service.id,
  });

  // Don't notify the person who scheduled themselves.
  const notified = await sendToUsers([member.user_id], payload, userId);
  return { status: 200, notified };
}

async function handleScheduleChanged(userId: string, churchId: string, serviceId: string) {
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id, title, date, time, church_id')
    .eq('id', serviceId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (!service) return { status: 404, notified: 0 };

  const { data: assignments } = await supabaseAdmin
    .from('service_assignments')
    .select('id, role, team_members(user_id)')
    .eq('service_id', serviceId);

  const memberIds = ((assignments || []) as Array<{ team_members?: MemberLookup | MemberLookup[] | null }>)
    .map((assignment) => firstRow<MemberLookup>(assignment.team_members)?.user_id);

  const payload = scheduleChangedPush({
    serviceTitle: service.title,
    serviceDate: service.date,
    serviceTime: service.time || '',
    serviceId: service.id,
  });

  const notified = await sendToUsers(memberIds, payload, userId);
  return { status: 200, notified };
}

async function handleMention(
  userId: string,
  churchId: string,
  messageId: string,
  kind: 'channel' | 'service'
) {
  let content = '';
  let senderId = '';
  let churchMatch = false;
  let url = '';
  let label = 'chat';

  if (kind === 'channel') {
    const { data: message } = await supabaseAdmin
      .from('chat_messages')
      .select('id, user_id, content, channel_id, church_id')
      .eq('id', messageId)
      .maybeSingle();

    if (!message) return { status: 404, notified: 0 };
    if (message.user_id !== userId) return { status: 403, notified: 0 };

    churchMatch = message.church_id === churchId;
    if (!message.church_id) {
      const { data: channel } = await supabaseAdmin
        .from('chat_channels')
        .select('id, church_id')
        .eq('id', message.channel_id)
        .maybeSingle();
      churchMatch = channel?.church_id === churchId;
    }

    content = message.content;
    senderId = message.user_id;
    url = `/chat?channel=${message.channel_id}`;
    label = 'chat';
  } else {
    const { data: message } = await supabaseAdmin
      .from('service_chat_messages')
      .select('id, user_id, content, chat_id')
      .eq('id', messageId)
      .maybeSingle();

    if (!message) return { status: 404, notified: 0 };
    if (message.user_id !== userId) return { status: 403, notified: 0 };

    const { data: chat } = await supabaseAdmin
      .from('service_chats')
      .select('id, service_id, church_id')
      .eq('id', message.chat_id)
      .maybeSingle();

    if (!chat) return { status: 404, notified: 0 };
    churchMatch = chat.church_id === churchId;

    let serviceTitle = 'service';
    if (chat.service_id) {
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('id, title, church_id')
        .eq('id', chat.service_id)
        .eq('church_id', churchId)
        .maybeSingle();
      if (service) serviceTitle = service.title;
      url = `/services/${chat.service_id}?tab=chat`;
      label = `${serviceTitle} chat`;
    } else {
      url = '/chat';
    }

    content = message.content;
    senderId = message.user_id;
  }

  if (!churchMatch) return { status: 403, notified: 0 };
  if (!content.includes('@')) return { status: 200, notified: 0 };

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('church_id', churchId);

  const churchUsers = (users || []) as Array<{ id: string; name: string | null }>;
  const mentionedIds = findMentionedUserIds(
    content,
    churchUsers.map((user) => ({ id: user.id, name: user.name || '' }))
  );

  const senderName =
    churchUsers.find((user) => user.id === senderId)?.name || 'A teammate';

  const payload = mentionPush({
    senderName,
    message: content,
    label,
    url,
  });

  const notified = await sendToUsers(
    mentionedIds.filter((id) => id !== senderId),
    payload
  );

  return { status: 200, notified };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `push-events:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const subscriptionCheck = await requireActiveSubscription(request);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsed = PushEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidInputResponse();
    }

    if (!isPushConfigured()) {
      return NextResponse.json({ success: true, skipped: 'not_configured' });
    }

    if (!user.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    const event = parsed.data;

    if (event.type === 'mention') {
      const result = await handleMention(user.id, user.church_id, event.messageId, event.kind);
      return NextResponse.json({ success: true, notified: result.notified }, { status: result.status });
    }

    if (user.role !== 'admin' && user.role !== 'leader') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result =
      event.type === 'assignment_created'
        ? await handleAssignmentCreated(user.id, user.church_id, event.assignmentId)
        : await handleScheduleChanged(user.id, user.church_id, event.serviceId);

    return NextResponse.json({ success: true, notified: result.notified }, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
