import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uuid } from '#lib/coaches';

// Polled by the trackside page. Access is checked in the database on every request.
export const GET: RequestHandler = async ({ locals, params }) => {
  const headers = { 'cache-control': 'private, no-store' };
  if (!locals.supabase || !locals.user)
    return json({ message: 'Signed out. Sign in again to resume.' }, { status: 401, headers });
  if (!uuid(params.sessionId))
    return json({ message: 'Session not found.' }, { status: 404, headers });
  const { data, error } = await locals.supabase.rpc('session_trackside', {
    p_session_id: params.sessionId
  });
  if (error)
    return json(
      {
        message:
          error.code === '42501'
            ? 'Access removed or session unavailable.'
            : 'Couldn’t refresh. Check your connection and that migration 014 is applied.'
      },
      { status: error.code === '42501' ? 404 : 503, headers }
    );
  return json(data, { headers });
};
