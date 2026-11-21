import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/club');
  return { configured: locals.backendReady };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.supabase)
      return fail(503, { message: 'Club storage is not configured yet.' });

    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!email || email.length > 254 || !password || password.length > 1024)
      return fail(400, { message: 'Enter your email and password.' });

    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase sign-in failed:', {
        code: error.code,
        status: error.status
      });

      return fail(400, {
        message: 'Unable to sign in. Check your details or contact your club administrator.'
      });
    }

    redirect(303, '/club');
  }
};
