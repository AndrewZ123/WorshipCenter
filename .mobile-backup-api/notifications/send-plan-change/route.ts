import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { formatChangesForEmail } from '@/lib/planChanges';
import { z } from 'zod';

const SendPlanChangeSchema = z.object({
  churchId: z.string().uuid(),
  serviceId: z.string().uuid(),
  serviceTitle: z.string().min(1).max(200),
  changes: z.array(z.object({
    type: z.enum(['key_changed', 'item_added', 'item_removed']),
    itemTitle: z.string(),
    itemType: z.enum(['song', 'segment']),
    oldKey: z.string().optional(),
    newKey: z.string().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = SendPlanChangeSchema.parse(await request.json());
    const { churchId, serviceId, serviceTitle, changes } = body;

    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const church = await db.churches.getById(churchId);
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 400 });
    }

    // Gather recipients: assigned members + leaders
    const [assignments, churchUsers] = await Promise.all([
      supabaseAdmin
        .from('service_assignments')
        .select('team_member_id')
        .eq('service_id', serviceId),
      supabaseAdmin
        .from('users')
        .select('id, email, name, role')
        .eq('church_id', churchId)
        .neq('role', 'team'),
    ]);

    const assignmentsList: Array<{ team_member_id: string }> = assignments.data || [];
    const assignedTeamMemberIds = new Set(assignmentsList.map(a => a.team_member_id));

    const teamMembersResult = assignedTeamMemberIds.size > 0
      ? await supabaseAdmin
          .from('team_members')
          .select('id, name, email, user_id')
          .eq('church_id', churchId)
          .in('id', Array.from(assignedTeamMemberIds))
      : null;

    const teamMembersList: Array<{ id: string; name: string; email: string; user_id: string }> = teamMembersResult?.data || [];

    const assignedEmails: Array<{ name: string; email: string }> = teamMembersList
      .filter((tm: { email: string }) => tm.email)
      .map((tm: { name: string; email: string }) => ({ name: tm.name, email: tm.email }));

    const churchUsersList: Array<{ id: string; email: string; name: string; role: string }> = churchUsers.data || [];

    const leaderEmails: Array<{ name: string; email: string }> = churchUsersList
      .filter((u: { email: string }) => u.email)
      .map((u: { name: string; email: string }) => ({ name: u.name, email: u.email }));

    const allRecipients = [...assignedEmails, ...leaderEmails];
    const seen = new Set<string>();
    const uniqueRecipients = allRecipients.filter(r => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    if (uniqueRecipients.length === 0) {
      return NextResponse.json({ error: 'No recipients' }, { status: 400 });
    }

    const diffHtml = formatChangesForEmail(changes);
    const changesCount = changes.length;
    const subject = `Plan Updated: ${serviceTitle} (${changesCount} change${changesCount > 1 ? 's' : ''})`;

    let sentCount = 0;
    for (const recipient of uniqueRecipients) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D9488;">Plan Updated: ${serviceTitle}</h2>
          <p>Hi ${recipient.name.split(' ')[0] || 'there'},</p>
          <p>The service plan for <strong>${serviceTitle}</strong> has been updated with the following changes:</p>
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; margin: 16px 0; font-size: 14px; line-height: 1.8; color: #4B5563;">
            ${diffHtml}
          </div>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/services/${serviceId}" style="background: #0D9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View in App</a></p>
          <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">This is an automated message from WorshipCenter.</p>
        </div>
      `;
      const text = `Plan Updated: ${serviceTitle}\n\nChanges:\n${changes.map(c => {
        switch (c.type) {
          case 'key_changed': return `• Key change: ${c.oldKey || '?'} → ${c.newKey || '?'} for "${c.itemTitle}"`;
          case 'item_added': return `• Added: ${c.itemTitle}`;
          case 'item_removed': return `• Removed: ${c.itemTitle}`;
        }
      }).join('\n')}\n\nView in app: ${process.env.NEXT_PUBLIC_APP_URL || ''}/services/${serviceId}`;

      const result = await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
      });
      if (result.success) sentCount++;
    }

    return NextResponse.json({ success: true, sentCount, totalRecipients: uniqueRecipients.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[Send Plan Change] Error:', error);
    return NextResponse.json({ error: 'Failed to send plan change notifications' }, { status: 500 });
  }
}
