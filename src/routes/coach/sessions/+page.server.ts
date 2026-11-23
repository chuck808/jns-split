import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { sessionFilters, type SessionList } from '#lib/training-sessions';
export const load: PageServerLoad = async (event) => {
  const { client } = requireUser(event);
  const filters = sessionFilters(event.url.searchParams);
  const { data, error: problem } = await client.rpc('list_training_sessions', {
    p_club_id: null,
    p_status: filters.status,
    p_page: filters.page
  });
  if (problem)
    error(503, 'Unable to load assigned sessions. Check the session planning migration.');
  return { list: data as SessionList, filters };
};
