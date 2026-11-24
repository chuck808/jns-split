import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { passwordProblem } from '#lib/server/recovery';
import { emailAddress } from '#lib/coaches';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/app');
  return { configured: locals.backendReady };
};

// The same reply whether or not the address already has an account, so the
// page can't be used to find out who is registered.
const sent = (email: string) => ({
  sent: true as const,
  email,
  message: `If ${email} can be used, a confirmation link is on its way. Open it on this device to finish. Check your spam folder too.`
});

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.supabase) return fail(503, { message: 'Accounts aren’t set up here yet.' });
    const form = await request.formData();
    const email = emailAddress(form.get('email'));
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (!email) return fail(400, { message: 'Enter a valid email address.' });
    const problem = passwordProblem(password, confirmation);
    if (problem) return fail(400, { message: problem, email });
    const { data, error } = await locals.supabase.auth.signUp({ email, password });
    if (error) {
      console.error('Supabase sign-up failed:', { code: error.code, status: error.status });
      if (error.code === 'weak_password')
        return fail(400, {
          message:
            'That password is too easy to guess. Try a longer one, such as three or four words.',
          email
        });
      if (error.code === 'signup_disabled')
        return fail(400, {
          message: 'New accounts are switched off for this installation. Ask your club for help.',
          email
        });
      if (error.code === 'over_email_send_rate_limit' || error.status === 429)
        return fail(429, {
          message: 'Too many emails have been sent in a short time. Please try again in an hour.',
          email
        });
      if (error.code !== 'user_already_exists' && error.code !== 'email_exists')
        return fail(400, { message: 'Your account couldn’t be created. Please try again.', email });
    }
    // Installations with email confirmation switched off sign people straight in.
    if (data?.session) redirect(303, '/app');
    return sent(email);
  },
  resend: async ({ request, locals }) => {
    if (!locals.supabase) return fail(503, { message: 'Accounts aren’t set up here yet.' });
    const email = emailAddress((await request.formData()).get('email'));
    if (!email) return fail(400, { message: 'Enter a valid email address.' });
    const { error } = await locals.supabase.auth.resend({ type: 'signup', email });
    if (error?.status === 429)
      return fail(429, {
        message: 'Please wait a minute or two before asking for another link.',
        sent: true,
        email
      });
    return sent(email);
  }
};
