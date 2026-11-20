import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
export const load: PageServerLoad = (event) => {
  const { user } = requireUser(event);
  return {
    email: user.email ?? '',
    passwordUpdated: event.url.searchParams.get('password') === 'updated'
  };
};
