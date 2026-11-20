import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { recoveryToken } from '#lib/server/recovery';
const cookie = 'recovery-token';
export const load: PageServerLoad = ({ url, cookies, locals }) => {
  if (url.searchParams.has('token_hash')) {
    const token = recoveryToken(url.searchParams.get('token_hash'));
    if (token && url.searchParams.get('type') === 'recovery')
      cookies.set(cookie, token, {
        path: '/auth/confirm',
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        maxAge: 600
      });
    else cookies.delete(cookie, { path: '/auth/confirm' });
    // Remove the token from the rendered page URL. GET does not consume it at Supabase.
    redirect(303, '/auth/confirm');
  }
  return { ready: locals.backendReady && !!recoveryToken(cookies.get(cookie)) };
};
export const actions: Actions = {
  default: async ({ locals, cookies }) => {
    const token_hash = recoveryToken(cookies.get(cookie));
    if (!token_hash || !locals.supabase)
      return fail(400, { message: 'This link is unavailable. Request a new reset email.' });
    const { error } = await locals.supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
    cookies.delete(cookie, { path: '/auth/confirm' });
    if (error)
      return fail(400, {
        message: 'This link has expired or has already been used. Request a new reset email.'
      });
    redirect(303, '/reset-password');
  }
};
