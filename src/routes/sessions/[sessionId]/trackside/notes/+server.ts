import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uuid } from '#lib/coaches';

// Saves or clears a coach note on one effort. Access is checked in the database.
export const POST: RequestHandler = async ({ locals, request }) => {
  const headers = { 'cache-control': 'private, no-store' };
  if (!locals.supabase || !locals.user)
    return json({ message: 'Signed out. Sign in again to save notes.' }, { status: 401, headers });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ message: 'Send the note as JSON.' }, { status: 415, headers });
  let body: { effortId?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid note.' }, { status: 400, headers });
  }
  const note = typeof body.note === 'string' ? body.note.trim() : null;
  if (
    typeof body.effortId !== 'string' ||
    !uuid(body.effortId) ||
    note === null ||
    note.length > 280
  )
    return json({ message: 'Notes are up to 280 characters.' }, { status: 400, headers });
  const { data, error } = await locals.supabase.rpc('set_effort_note', {
    p_effort_id: body.effortId,
    p_body: note
  });
  if (error)
    return json(
      {
        message:
          error.code === '42501'
            ? 'You can’t add notes to this session.'
            : 'The note couldn’t be saved. Check your connection and that migration 017 is applied.'
      },
      { status: error.code === '42501' ? 403 : 503, headers }
    );
  return json({ note: data ?? null }, { headers });
};
