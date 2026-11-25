import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uuid } from '#lib/coaches';
import { jsonDownload } from '#lib/server/export';

// The family's own download: what the app shows them about one linked rider.
export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.supabase || !locals.user) error(401, 'Sign in to download.');
  if (!uuid(params.riderId)) error(404, 'Rider not found.');
  const { data, error: problem } = await locals.supabase.rpc('my_rider_export', {
    p_rider_id: params.riderId
  });
  if (problem?.code === '42501') error(404, 'Rider not found.');
  if (problem) error(503, 'The download isn’t available. Check that migration 020 is applied.');
  return jsonDownload(data, data?.rider?.name ?? 'rider', 'rider-data');
};
