import nodemailer from 'nodemailer';

/** Settings for sending invitation emails. All optional: without them, nothing is sent. */
export interface MailConfig {
  appUrl: string;
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export interface Mailer {
  appUrl: string;
  send(message: MailMessage): Promise<void>;
}

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function mailConfig(env: Record<string, string | undefined>): MailConfig | null {
  const host = env.SMTP_HOST?.trim() ?? '';
  const user = env.SMTP_USER?.trim() ?? '';
  const password = env.SMTP_PASSWORD ?? '';
  const from = env.EMAIL_FROM?.trim() ?? '';
  const port = Number(env.SMTP_PORT?.trim() || '587');
  let appUrl: URL;
  try {
    appUrl = new URL(env.APP_URL?.trim() ?? '');
  } catch {
    return null;
  }
  if (!host || !user || !password || !from || /[\r\n]/.test(from + host + user)) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password)
    return null;
  const address = from.match(/<([^>]+)>\s*$/)?.[1] ?? from;
  if (!emailPattern.test(address)) return null;
  return { appUrl: appUrl.origin, host, port, user, password, from };
}

export function smtpMailer(config: MailConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    // Plain text and HTML we wrote ourselves: no attachments, files or URLs to fetch.
    disableFileAccess: true,
    disableUrlAccess: true
  });
  return {
    appUrl: config.appUrl,
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    }
  };
}

export type InviteKind = 'coach' | 'guardian' | 'rider';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim();

/**
 * The invitation email. It names the club but never the rider: if an address
 * was typed wrongly, a stranger learns nothing about a child.
 */
export function invitationEmail(
  kind: InviteKind,
  clubName: string,
  to: string,
  appUrl: string
): MailMessage {
  const club = oneLine(clubName).slice(0, 120);
  const what = (name: string) =>
    ({
      coach: `to coach with ${name} on JNS SPLIT, the club’s timing app`,
      guardian: `to follow a rider at ${name} on JNS SPLIT, as their parent or guardian`,
      rider: `to link your account to your rider record at ${name} on JNS SPLIT`
    })[kind];
  const where = kind === 'coach' ? 'Coach' : 'Riders and family';
  const signin = `${appUrl}/login`;
  const signup = `${appUrl}/signup`;
  const text = [
    `Hello,`,
    ``,
    `${club} has invited you ${what(club)}.`,
    ``,
    `To accept:`,
    `1. Sign in with this email address (${to}): ${signin}`,
    `   New to JNS SPLIT? Create an account with this address: ${signup}`,
    `2. Open ${where} and choose Accept.`,
    ``,
    `The invitation lasts seven days and only works for this email address.`,
    `If you weren’t expecting it, you can ignore this email. Nothing happens unless you accept.`
  ].join('\n');
  const html = `<p>Hello,</p>
<p>${escapeHtml(club)} has invited you ${what(`<strong>${escapeHtml(club)}</strong>`)}.</p>
<p><strong>To accept:</strong></p>
<ol>
<li><a href="${escapeHtml(signin)}">Sign in</a> with this email address (${escapeHtml(to)}).<br>New to JNS SPLIT? <a href="${escapeHtml(signup)}">Create an account</a> with this address.</li>
<li>Open <strong>${where}</strong> and choose <strong>Accept</strong>.</li>
</ol>
<p>The invitation lasts seven days and only works for this email address.</p>
<p>If you weren’t expecting it, you can ignore this email. Nothing happens unless you accept.</p>`;
  return { to, subject: `${club} invited you to JNS SPLIT`, text, html };
}

export type SendOutcome = 'sent' | 'off' | 'failed';

/** Sends an invitation email if email is set up. Never throws: the invitation already exists. */
export async function sendInvitation(
  mailer: Mailer | null,
  kind: InviteKind,
  clubName: string,
  to: string
): Promise<SendOutcome> {
  if (!mailer) return 'off';
  try {
    await mailer.send(invitationEmail(kind, clubName, to, mailer.appUrl));
    return 'sent';
  } catch (e) {
    // Never log the address or the message body.
    console.error('Invitation email failed:', (e as { code?: string })?.code ?? 'unknown');
    return 'failed';
  }
}

/** What to tell the admin after an invitation is created. */
export function invitationNotice(outcome: SendOutcome, email: string, where: string): string {
  if (outcome === 'sent')
    return `Invitation emailed to ${email}. It lasts seven days and only works for that address.`;
  if (outcome === 'failed')
    return `Invitation created, but the email to ${email} couldn’t be sent. Ask them to sign in (or create an account at /signup) with that address and open ${where} within seven days.`;
  return `Invitation created. No email has been sent. Ask them to sign in (or create an account at /signup) with ${email} and open ${where} within seven days.`;
}
