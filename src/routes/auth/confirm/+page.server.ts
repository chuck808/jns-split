import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { recoveryToken } from '#lib/server/recovery';

// Email links carry a one-time token. Opening the link (GET) only stores it in a
// short-lived cookie and strips it from the URL; the explicit form POST verifies
// it, so email scanners that prefetch links cannot use it up.
const recovery = 'recovery-token';
const signup = 'signup-token';
const cookieOptions = (url: URL) => ({
  path: '/auth/confirm',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: url.protocol === 'https:',
  maxAge: 600
});

export const load: PageServerLoad = ({ url, cookies, locals }) => {
  if (url.searchParams.has('token_hash')) {
    const token = recoveryToken(url.searchParams.get('token_hash'));
    const type = url.searchParams.get('type');
    cookies.delete(recovery, { path: '/auth/confirm' });
    cookies.delete(signup, { path: '/auth/confirm' });
    if (token && type === 'recovery') cookies.set(recovery, token, cookieOptions(url));
    else if (token && (type === 'email' || type === 'signup'))
      cookies.set(signup, token, cookieOptions(url));
    redirect(303, '/auth/confirm');
  }
  const kind = recoveryToken(cookies.get(signup))
    ? 'signup'
    : recoveryToken(cookies.get(recovery))
      ? 'recovery'
      : null;
  return { ready: locals.backendReady && !!kind, kind };
};

export const actions: Actions = {
  default: async ({ locals, cookies }) => {
    const signupToken = recoveryToken(cookies.get(signup));
    if (signupToken) {
      cookies.delete(signup, { path: '/auth/confirm' });
      if (!locals.supabase)
        return fail(400, { message: 'This link is unavailable.', kind: 'signup' });
      const { error } = await locals.supabase.auth.verifyOtp({
        token_hash: signupToken,
        type: 'email'
      });
      if (error)
        return fail(400, {
          message:
            'This link has expired or has already been used. If you can’t sign in, create your account again to get a new link.',
          kind: 'signup'
        });
      redirect(303, '/app');
    }
    const token_hash = recoveryToken(cookies.get(recovery));
    if (!token_hash || !locals.supabase)
      return fail(400, {
        message: 'This link is unavailable. Request a new reset email.',
        kind: 'recovery'
      });
    const { error } = await locals.supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
    cookies.delete(recovery, { path: '/auth/confirm' });
    if (error)
      return fail(400, {
        message: 'This link has expired or has already been used. Request a new reset email.',
        kind: 'recovery'
      });
    redirect(303, '/reset-password');
  }
};
