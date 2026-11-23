import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uuid } from '#lib/coaches';
export const GET: RequestHandler = async ({ locals, params, url }) => {
  const headers = { 'cache-control': 'private, no-store' };
  if (!locals.supabase || !locals.user)
    return json({ message: 'Sign in again to view test lanes.' }, { status: 401, headers });
  const session = url.searchParams.get('sessionId') ?? '';
  if (!uuid(params.clubId) || !uuid(session))
    return json({ message: 'Choose a valid test session.' }, { status: 400, headers });
  // The RPC checks both club administrator membership and session ownership on every poll.
  const { data, error } = await locals.supabase.rpc('bench_monitor', {
    p_club_id: params.clubId,
    p_session_id: session
  });
  if (error)
    return json(
      {
        message:
          error.code === '42501'
            ? 'Session unavailable or access removed.'
            : 'Unable to refresh test lanes. Check migration 008 and your connection.'
      },
      { status: error.code === '42501' ? 404 : 503, headers }
    );
  return json(data, { headers });
};
