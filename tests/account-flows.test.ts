import test from 'node:test';
import assert from 'node:assert/strict';
import { theme, returnPath } from '../src/lib/preferences';
import { passwordProblem, recoveryToken } from '../src/lib/server/recovery';
import {
  load as confirmLoad,
  actions as confirmActions
} from '../src/routes/auth/confirm/+page.server';
import { actions as resetActions } from '../src/routes/reset-password/+page.server';
import { actions as forgotActions } from '../src/routes/forgot-password/+page.server';

test('preferences reject external redirects and unknown themes', () => {
  assert.equal(theme('light'), 'light');
  assert.equal(theme('evil'), 'system');
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', 'javascript:alert(1)'])
    assert.equal(returnPath(path), '/');
  assert.equal(returnPath('/club?tab=riders'), '/club?tab=riders');
});
test('recovery input validation', () => {
  assert.equal(recoveryToken('a'.repeat(64)), 'a'.repeat(64));
  assert.equal(recoveryToken('junk'), null);
  assert.ok(passwordProblem('short', 'short'));
  assert.ok(passwordProblem('long-password', 'different'));
  assert.equal(passwordProblem('long-password', 'long-password'), null);
});
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
    locals: { backendReady: true, user: { id: 'user' }, supabase: null as any }
  } as any;
}
const redirected = (e: any) => e.status === 303;
test('opening email link does not verify token; explicit POST verifies recovery only', async () => {
  const e = event('/auth/confirm?token_hash=' + 'a'.repeat(64) + '&type=recovery');
  let calls = 0;
  e.locals.supabase = {
    auth: {
      verifyOtp: async (input: any) => {
        calls++;
        assert.equal(input.type, 'recovery');
        return { error: null };
      }
    }
  };
  assert.throws(() => confirmLoad(e), redirected);
  assert.equal(calls, 0);
  assert.equal(e.cookies.get('recovery-token'), 'a'.repeat(64));
  await assert.rejects(async () => confirmActions.default(e), redirected);
  assert.equal(calls, 1);
  assert.equal(e.cookies.get('recovery-token'), undefined);
  const result: any = await confirmActions.default(e);
  assert.equal(result.status, 400);
  assert.equal(calls, 1);
});
test('expired recovery link is cleared and reports a safe error', async () => {
  const e = event('/auth/confirm');
  e.cookies.set('recovery-token', 'a'.repeat(64));
  e.locals.supabase = { auth: { verifyOtp: async () => ({ error: { code: 'otp_expired' } }) } };
  const result: any = await confirmActions.default(e);
  assert.equal(result.status, 400);
  assert.equal(e.cookies.get('recovery-token'), undefined);
});
test('password reset requires authenticated user and matching password before update', async () => {
  const e = event('/reset-password', { password: 'long-password', confirmation: 'different' });
  let calls = 0;
  e.locals.supabase = {
    auth: {
      updateUser: async () => {
        calls++;
        return { error: null };
      }
    }
  };
  const result: any = await resetActions.default(e);
  assert.equal(result.status, 400);
  assert.equal(calls, 0);
  e.locals.user = null;
  await assert.rejects(async () => resetActions.default(e), redirected);
  assert.equal(calls, 0);
});
test('forgot password uses identical response for unknown or known addresses', async () => {
  const e = event('/forgot-password', { email: 'test@example.test' });
  e.locals.supabase = { auth: { resetPasswordForEmail: async () => ({ error: null }) } };
  const known = await forgotActions.default(e);
  e.request = new Request('https://app.test/forgot-password', {
    method: 'POST',
    body: new URLSearchParams({ email: 'missing@example.test' })
  });
  e.locals.supabase.auth.resetPasswordForEmail = async () => ({ error: { code: 'unknown_user' } });
  assert.deepEqual(await forgotActions.default(e), known);
});

test('matching password updates the authenticated account and redirects without echoing secrets', async () => {
  const e = event('/reset-password', { password: 'a-new-long-password', confirmation: 'a-new-long-password' });
  let calls = 0;
  e.locals.supabase = { auth: { updateUser: async (input: { password: string }) => {
    calls++;
    assert.equal(input.password, 'a-new-long-password');
    return { error: null };
  } } };
  await assert.rejects(async () => resetActions.default(e), (result: any) => result.status === 303 && result.location === '/account?password=updated');
  assert.equal(calls, 1);
});
