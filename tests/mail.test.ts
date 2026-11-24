import test from 'node:test';
import assert from 'node:assert/strict';
import {
  invitationEmail,
  invitationNotice,
  mailConfig,
  sendInvitation,
  type MailMessage
} from '../src/lib/server/mail';

const env = {
  APP_URL: 'https://split.example/',
  SMTP_HOST: 'smtp.example',
  SMTP_PORT: '587',
  SMTP_USER: 'resend',
  SMTP_PASSWORD: 'secret',
  EMAIL_FROM: 'JNS SPLIT <no-reply@split.example>'
};

test('email settings: complete and valid, or off', () => {
  const config = mailConfig(env);
  assert.equal(config?.appUrl, 'https://split.example');
  assert.equal(config?.port, 587);
  assert.equal(mailConfig({ ...env, SMTP_PORT: '' })?.port, 587);
  assert.equal(
    mailConfig({ ...env, EMAIL_FROM: 'no-reply@split.example' })?.from,
    'no-reply@split.example'
  );
  for (const broken of [
    {},
    { ...env, APP_URL: '' },
    { ...env, APP_URL: 'javascript:alert(1)' },
    { ...env, APP_URL: 'https://user:pass@split.example' },
    { ...env, SMTP_HOST: '' },
    { ...env, SMTP_PASSWORD: '' },
    { ...env, SMTP_PORT: '99999' },
    { ...env, SMTP_PORT: 'abc' },
    { ...env, EMAIL_FROM: 'JNS SPLIT' },
    { ...env, EMAIL_FROM: 'a@b.example\r\nBcc: x@evil.example' }
  ])
    assert.equal(mailConfig(broken), null, JSON.stringify(broken));
});

test('invitation emails name the club, never the rider, and escape it', () => {
  const club = 'Riverside <b>BMX</b> & Co\r\nBcc: evil@example.test';
  const m = invitationEmail('guardian', club, 'parent@example.test', 'https://split.example');
  assert.equal(m.to, 'parent@example.test');
  assert.equal(/[\r\n]/.test(m.subject), false, 'no header injection through the subject');
  assert.ok(m.subject.startsWith('Riverside <b>BMX</b> & Co Bcc'));
  assert.equal(m.html.includes('<b>BMX</b>'), false);
  assert.ok(m.html.includes('Riverside &lt;b&gt;BMX&lt;/b&gt; &amp; Co'));
  assert.ok(m.text.includes('https://split.example/login'));
  assert.ok(m.text.includes('https://split.example/signup'));
  assert.ok(m.text.includes('Riders and family'));
  assert.ok(m.text.includes('parent or guardian'));
  assert.ok(
    invitationEmail('coach', 'Club', 'c@example.test', 'https://x.example').text.includes(
      'Open Coach'
    )
  );
  assert.ok(
    invitationEmail('rider', 'Club', 'r@example.test', 'https://x.example').text.includes(
      'your rider record'
    )
  );
});

test('sending never throws: off, sent or failed', async () => {
  assert.equal(await sendInvitation(null, 'coach', 'Club', 'c@example.test'), 'off');
  const sent: MailMessage[] = [];
  const ok = { appUrl: 'https://x.example', send: async (m: MailMessage) => void sent.push(m) };
  assert.equal(await sendInvitation(ok, 'guardian', 'Club', 'p@example.test'), 'sent');
  assert.equal(sent[0].to, 'p@example.test');
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const broken = {
      appUrl: 'https://x.example',
      send: async () => {
        throw Object.assign(new Error('auth failed for p@example.test'), { code: 'EAUTH' });
      }
    };
    assert.equal(await sendInvitation(broken, 'guardian', 'Club', 'p@example.test'), 'failed');
  } finally {
    console.error = original;
  }
  assert.equal(JSON.stringify(errors).includes('p@example.test'), false, 'never logs the address');
  assert.ok(JSON.stringify(errors).includes('EAUTH'));
});

test('the admin is told honestly what happened', () => {
  assert.ok(invitationNotice('sent', 'a@example.test', 'Coach').startsWith('Invitation emailed'));
  assert.ok(invitationNotice('failed', 'a@example.test', 'Coach').includes('couldn’t be sent'));
  assert.ok(invitationNotice('off', 'a@example.test', 'Coach').includes('No email has been sent'));
});
