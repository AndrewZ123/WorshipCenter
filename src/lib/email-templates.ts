/**
 * Shared email templates matching WorshipCenter Chakra theme.
 * Colors drawn from src/theme/index.ts (teal #0D9488, Inter, gray scale).
 */
const TEAL = '#0D9488';
const GRAY_800 = '#1F2937';
const GRAY_600 = '#4B5563';
const GRAY_400 = '#9CA3AF';
const BG = '#F9FAFB';
const BORDER = '1px solid #E5E7EB';

function baseLayout(body: string, churchName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{margin:0;padding:0;background:${BG};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrapper{padding:32px 16px}
.container{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:${BORDER};overflow:hidden}
.header{background:${TEAL};padding:24px 32px;text-align:center}
.header h1{margin:0;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.01em}
.body{padding:32px}
.body p{font-size:15px;line-height:1.7;color:${GRAY_600};margin:0 0 16px}
.body strong{color:${GRAY_800}}
.detail-box{background:${BG};border:${BORDER};border-radius:8px;padding:16px 20px;margin:16px 0}
.detail-row{display:block;font-size:14px;color:${GRAY_600};padding:4px 0}
.detail-row strong{display:inline-block;min-width:80px;font-weight:600;color:${GRAY_800}}
.cta{display:block;text-align:center;background:${TEAL};color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;margin:24px 0}
.cta-secondary{display:inline-block;color:${TEAL}!important;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px}
.footer{padding:20px 32px 24px;border-top:${BORDER};text-align:center;font-size:12px;color:${GRAY_400}}
.footer a{color:${TEAL};text-decoration:none}
</style></head><body>
<div class="wrapper"><div class="container">
<div class="header"><h1>${churchName}</h1></div>
<div class="body">${body}</div>
<div class="footer">
  <p>WorshipCenter — Making worship planning easy</p>
  <p><a href="mailto:support@worshipcenter.app">Contact Support</a></p>
</div></div></div></body></html>`;
}

function formatDate(d: string): string {
  try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

function formatRole(r: string): string {
  return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function detailRow(label: string, value: string): string {
  return `<span class="detail-row"><strong>${label}</strong>${value}</span>`;
}

interface WelcomeParams { adminName: string; churchName: string; appUrl: string; }
export function welcomeEmail(p: WelcomeParams): { html: string; text: string } {
  const html = baseLayout(`
    <p>Hey ${p.adminName},</p>
    <p>Welcome to WorshipCenter at <strong>${p.churchName}</strong>! Your church account is set up and ready to go.</p>
    <a href="${p.appUrl}/dashboard" class="cta">Go to Dashboard</a>
    <p><strong>Getting started:</strong><br>• Create your first service plan<br>• Add songs to your library<br>• Invite team members</p>
    <p>Need help? Just reply to this email.</p>
  `, p.churchName);
  const text = `Welcome to WorshipCenter at ${p.churchName}!\n\nGet started: ${p.appUrl}/dashboard\n\nNeed help? Reply to this email.`;
  return { html, text };
}

interface TeamInviteParams { name: string; churchName: string; inviteUrl: string; }
export function teamInvitationEmail(p: TeamInviteParams): { html: string; text: string } {
  const html = baseLayout(`
    <p>Hello ${p.name || 'there'},</p>
    <p>You've been invited to join the worship team at <strong>${p.churchName}</strong> on WorshipCenter.</p>
    <a href="${p.inviteUrl}" class="cta">Accept Invitation</a>
  `, p.churchName);
  const text = `You're invited to join ${p.churchName} on WorshipCenter!\n\n${p.inviteUrl}`;
  return { html, text };
}

interface ServiceInviteParams {
  memberName: string; churchName: string; serviceTitle: string;
  serviceDate: string; serviceTime: string; role: string;
  acceptUrl: string; declineUrl: string;
}
export function serviceInvitationEmail(p: ServiceInviteParams): { html: string; text: string } {
  const date = formatDate(p.serviceDate);
  const role = formatRole(p.role);
  const html = baseLayout(`
    <p>Hi ${p.memberName},</p>
    <p>You've been scheduled to serve at <strong>${p.churchName}</strong>.</p>
    <div class="detail-box">
      ${detailRow('Service:', p.serviceTitle)}
      ${detailRow('Date:', date)}
      ${detailRow('Time:', p.serviceTime)}
      ${detailRow('Role:', role)}
    </div>
    <a href="${p.acceptUrl}" class="cta">Yes, I Can Serve</a>
    <div style="text-align:center"><a href="${p.declineUrl}" class="cta-secondary">Can't make it — let us know</a></div>
  `, p.churchName);
  const text = `Service Invitation: ${p.serviceTitle}\nDate: ${date}\nTime: ${p.serviceTime}\nRole: ${role}\n\nAccept: ${p.acceptUrl}\nDecline: ${p.declineUrl}`;
  return { html, text };
}

interface ReminderParams {
  memberName: string; churchName: string; serviceTitle: string;
  serviceDate: string; serviceTime: string; role: string;
}
export function serviceReminderEmail(p: ReminderParams): { html: string; text: string } {
  const date = formatDate(p.serviceDate);
  const role = formatRole(p.role);
  const html = baseLayout(`
    <p>Hi ${p.memberName},</p>
    <p>Quick reminder — you're serving at <strong>${p.churchName}</strong> soon!</p>
    <div class="detail-box">
      ${detailRow('Service:', p.serviceTitle)}
      ${detailRow('Date:', date)}
      ${detailRow('Time:', p.serviceTime)}
      ${detailRow('Role:', role)}
    </div>
    <p style="font-size:13px;color:${GRAY_400}">Thanks for serving on the team.</p>
  `, p.churchName);
  const text = `Reminder: You're serving ${role} at ${p.churchName}\nService: ${p.serviceTitle}\nDate: ${date}\nTime: ${p.serviceTime}`;
  return { html, text };
}

interface ConfirmedParams {
  memberName: string; churchName: string; serviceTitle: string;
  serviceDate: string; serviceTime: string; role: string;
}
export function assignmentConfirmedEmail(p: ConfirmedParams): { html: string; text: string } {
  const date = formatDate(p.serviceDate);
  const role = formatRole(p.role);
  const html = baseLayout(`
    <p>Thanks ${p.memberName}!</p>
    <p>You're confirmed to serve at <strong>${p.churchName}</strong>.</p>
    <div class="detail-box">
      ${detailRow('Service:', p.serviceTitle)}
      ${detailRow('Date:', date)}
      ${detailRow('Time:', p.serviceTime)}
      ${detailRow('Role:', role)}
    </div>
    <p>We appreciate you being part of the team.</p>
  `, p.churchName);
  const text = `Confirmed: ${role} — ${p.churchName}\nService: ${p.serviceTitle}\nDate: ${date}\nTime: ${p.serviceTime}`;
  return { html, text };
}

interface DeclinedParams {
  churchName: string; serviceTitle: string; memberName: string; role: string;
}
export function assignmentDeclinedEmail(p: DeclinedParams): { html: string; text: string } {
  const role = formatRole(p.role);
  const html = baseLayout(`
    <p><strong>${p.memberName}</strong> has declined the <strong>${role}</strong> assignment for <strong>${p.serviceTitle}</strong>.</p>
    <p>You may want to find a replacement as soon as possible.</p>
  `, p.churchName);
  const text = `${p.memberName} declined ${role} for ${p.serviceTitle} at ${p.churchName}.`;
  return { html, text };
}