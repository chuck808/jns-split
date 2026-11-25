import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uuid } from '#lib/coaches';
import { jsonDownload } from '#lib/server/export';

// The club's full record for a formal request. The database checks the caller is a club admin
// and records the export in the club history. POST (a button, not a link) so nothing
// can trigger it by prefetching.
export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.supabase || !locals.user) error(401, 'Sign in to download.');
  if (!uuid(params.riderId) || !uuid(params.clubId)) error(404, 'Rider not found.');
  const { data, error: problem } = await locals.supabase.rpc('admin_rider_export', {
    p_rider_id: params.riderId
  });
  if (problem?.code === '42501') error(404, 'Rider not found.');
  if (problem) error(503, 'The export isn’t available. Check that migration 020 is applied.');
  return jsonDownload(data, data?.rider?.name ?? 'rider', 'full-record');
};
