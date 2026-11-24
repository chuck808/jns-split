import test from 'node:test';
import assert from 'node:assert/strict';
import { actions as signupActions, load as signupLoad } from '../src/routes/signup/+page.server';
import {
  load as confirmLoad,
  actions as confirmActions
} from '../src/routes/auth/confirm/+page.server';

function event(path: string, fields: Record<string, string> = {}) {
  const jar = new Map<string, string>();
  return {
    url: new URL(path, 'https://app.test'),
    request: new Request('https://app.test' + path, {
      method: 'POST',
      body: new URLSearchParams(fields)
    }),
    cookies: {
      get: (key: string) => jar.get(key),
      set: (key: string, value: string) => jar.set(key, value),
      delete: (key: string) => jar.delete(key)
    },
    locals: { backendReady: true, user: null, supabase: null as any }
  } as any;
}
const redirectedTo = (location: string) => (e: any) => e.status === 303 && e.location === location;
const good = {
  email: 'Parent@Example.test',
  password: 'four words long enough',
  confirmation: 'four words long enough'
};

test('signed-in visitors skip the sign-up page', () => {
  const e = event('/signup');
  e.locals.user = { id: 'u' };
  assert.throws(() => signupLoad(e), redirectedTo('/app'));
});

test('sign-up checks input before calling Supabase', async () => {
  let calls = 0;
  const auth = { signUp: async () => (calls++, { data: {}, error: null }) };
  for (const fields of [
    { ...good, email: 'not-an-email' },
    { ...good, password: 'short', confirmation: 'short' },
    { ...good, confirmation: 'something different here' }
  ]) {
    const e = event('/signup', fields);
    e.locals.supabase = { auth };
    const result: any = await signupActions.create(e);
    assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
});

test('sign-up gives the same reply for new and existing addresses', async () => {
  const e = event('/signup', good);
  let input: any;
  e.locals.supabase = {
    auth: {
      signUp: async (i: any) => {
        input = i;
        return { data: { user: { id: 'new' }, session: null }, error: null };
      }
    }
  };
  const fresh: any = await signupActions.create(e);
  assert.equal(input.email, 'parent@example.test');
  assert.equal(fresh.sent, true);
  assert.equal(JSON.stringify(fresh).includes(good.password), false, 'never echoes the password');

  const again = event('/signup', good);
  again.locals.supabase = {
    auth: {
      signUp: async () => ({ data: {}, error: { code: 'user_already_exists', status: 422 } })
    }
  };
  assert.deepEqual(await signupActions.create(again), fresh);
});

test('sign-up explains weak passwords and switched-off sign-up', async () => {
  for (const [code, words] of [
    ['weak_password', 'too easy'],
    ['signup_disabled', 'switched off']
  ]) {
    const e = event('/signup', good);
    e.locals.supabase = {
      auth: { signUp: async () => ({ data: {}, error: { code, status: 422 } }) }
    };
    const result: any = await signupActions.create(e);
    assert.equal(result.status, 400);
    assert.ok(result.data.message.includes(words), code);
  }
});

test('installations without email confirmation sign people straight in', async () => {
  const e = event('/signup', good);
  e.locals.supabase = {
    auth: { signUp: async () => ({ data: { session: { access_token: 'x' } }, error: null }) }
  };
  await assert.rejects(async () => signupActions.create(e), redirectedTo('/app'));
});

test('resend asks Supabase for a signup email and replies generically', async () => {
  const e = event('/signup', { email: 'parent@example.test' });
  let type = '';
  e.locals.supabase = { auth: { resend: async (i: any) => ((type = i.type), { error: null }) } };
  const result: any = await signupActions.resend(e);
  assert.equal(type, 'signup');
  assert.equal(result.sent, true);
});

test('signup link is verified only on POST, as an email confirmation, then opens the app', async () => {
  const token = 'b'.repeat(64);
  const e = event('/auth/confirm?token_hash=' + token + '&type=email');
  let calls = 0;
  e.locals.supabase = {
    auth: {
      verifyOtp: async (input: any) => {
        calls++;
        assert.equal(input.type, 'email');
        assert.equal(input.token_hash, token);
        return { error: null };
      }
    }
  };
  assert.throws(() => confirmLoad(e), redirectedTo('/auth/confirm'));
  assert.equal(calls, 0);
  assert.equal(e.cookies.get('signup-token'), token);
  assert.equal(e.cookies.get('recovery-token'), undefined);
  e.url = new URL('https://app.test/auth/confirm');
  assert.deepEqual(confirmLoad(e), { ready: true, kind: 'signup' });
  await assert.rejects(async () => confirmActions.default(e), redirectedTo('/app'));
  assert.equal(calls, 1);
  assert.equal(e.cookies.get('signup-token'), undefined);
});

test('an expired signup link is cleared and says what to do', async () => {
  const e = event('/auth/confirm');
  e.cookies.set('signup-token', 'b'.repeat(64));
  e.locals.supabase = { auth: { verifyOtp: async () => ({ error: { code: 'otp_expired' } }) } };
  const result: any = await confirmActions.default(e);
  assert.equal(result.status, 400);
  assert.equal(result.data.kind, 'signup');
  assert.equal(e.cookies.get('signup-token'), undefined);
});

test('an unknown link type stores nothing', () => {
  const e = event('/auth/confirm?token_hash=' + 'c'.repeat(64) + '&type=magiclink');
  assert.throws(() => confirmLoad(e), redirectedTo('/auth/confirm'));
  assert.equal(e.cookies.get('signup-token'), undefined);
  assert.equal(e.cookies.get('recovery-token'), undefined);
});
