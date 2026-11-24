import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
import { shellData } from '#lib/server/shell';
export const load: LayoutServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const { data, error: problem } = await client
    .from('clubs')
    .select('id,name,speed_unit')
    .eq('id', event.params.clubId)
    .single();
  if (problem)
    error(
      503,
      'Unable to load club settings. Apply the club workspace migration before using this release.'
    );
  return { club: data, ...(await shellData(event, `admin:${event.params.clubId}`)) };
};
