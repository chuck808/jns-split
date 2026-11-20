import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => ({ configured: locals.backendReady });
export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.supabase) return fail(503, { message: 'Account recovery is not configured.' });
    const email = String((await request.formData()).get('email') ?? '').trim();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return fail(400, { message: 'Enter a valid email address.' });
    // Never disclose whether an address exists. Supabase applies its Auth email rate limits.
    await locals.supabase.auth.resetPasswordForEmail(email);
    return {
      message:
        'If this address has an account and email delivery is available, a reset link will arrive shortly. Check your spam folder. If it does not arrive, contact your pilot administrator.'
    };
  }
};
