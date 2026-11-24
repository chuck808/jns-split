import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import type { TracksideData } from '#lib/trackside';

export const load: PageServerLoad = async (event) => {
  const { client } = requireUser(event);
  if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
  const { data, error: problem } = await client.rpc('session_trackside', {
    p_session_id: event.params.sessionId
  });
  if (problem?.code === '42501') error(404, 'Session unavailable or access removed.');
  if (problem) error(503, 'Unable to load the trackside view. Apply migration 014 first.');
  return { initial: data as TracksideData };
};
