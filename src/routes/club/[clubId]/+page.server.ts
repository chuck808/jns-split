import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Overview } from '#lib/club-workspace';
import { requireAdmin } from '#lib/server/access';
// Preserve submissions from a register tab opened before the route moved.
export { actions } from './riders/+page.server';
export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const { data, error: problem } = await client.rpc('club_overview', {
    p_club_id: event.params.clubId
  });
  if (problem)
    error(503, 'Unable to load the club overview. Check the workspace migration and try again.');
  return { overview: data as Overview };
};
