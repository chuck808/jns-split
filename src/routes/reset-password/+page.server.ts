import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { passwordProblem } from '#lib/server/recovery';
export const load: PageServerLoad = (event) => {
  requireUser(event);
  return {};
};
export const actions: Actions = {
  default: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const password = String(form.get('password') ?? '');
    const problem = passwordProblem(password, String(form.get('confirmation') ?? ''));
    if (problem) return fail(400, { message: problem });
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return fail(400, {
        message:
          'The password could not be changed. Check the project password requirements or request a fresh recovery link.'
      });
    redirect(303, '/account?password=updated');
  }
};
