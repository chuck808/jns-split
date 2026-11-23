import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePlatform } from '#lib/server/platform';
import { applicationFilters, type ApplicationList } from '#lib/club-admission';
export const load: PageServerLoad = async (event) => {
  const { client, overview } = await requirePlatform(event);
  const filters = applicationFilters(event.url.searchParams, 'submitted');
  const { data, error: problem } = await client.rpc('list_club_applications', {
    p_platform: true,
    p_status: filters.status,
    p_page: filters.page
  });
  if (problem) error(503, 'Unable to load applications.');
  return { overview, list: data as ApplicationList, filters };
};
