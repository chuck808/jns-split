import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser, messageForDatabaseError } from '#lib/server/access';
export const load: PageServerLoad = async (event) => {
  if (!event.locals.backendReady) redirect(303, '/login');
  const { client, user } = requireUser(event);
  const { data: memberships, error: membershipError } = await client
    .from('club_memberships')
    .select('club_id,role');
  const { data: clubs, error: clubError } = await client
    .from('clubs')
    .select('id,name')
    .order('name');
  return {
    email: user.email ?? '',
    clubs: clubs ?? [],
    hasMembership: !!memberships?.length,
    message:
      membershipError || clubError
        ? 'Unable to load clubs. Check the database setup and try again.'
        : ''
  };
};
export const actions: Actions = {
  create: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name || name.length > 100)
      return fail(400, { message: 'Enter a club name of 1–100 characters.' });
    const { data, error } = await client.rpc('create_club', { p_name: name });
    if (error) return fail(400, { message: messageForDatabaseError(error.code) });
    redirect(303, `/club/${data}`);
  }
};
