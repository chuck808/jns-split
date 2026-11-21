import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { newBenchToken } from '#lib/server/bench-device';
import { sessionFilters, type SessionList } from '#lib/training-sessions';
interface Device {
  id: string;
  name: string;
  session_id: string;
  expires_at: string;
  revoked: boolean;
}
export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const devices = await client.rpc('list_bench_devices', { p_club_id: event.params.clubId });
  const sessions = await client.rpc('list_training_sessions', {
    p_club_id: event.params.clubId,
    p_status: 'planned',
    p_page: sessionFilters(event.url.searchParams).page
  });
  if (devices.error || sessions.error)
    error(503, 'Unable to load test equipment. Apply migration 007 first.');
  return {
    devices: devices.data as Device[],
    sessions: sessions.data as SessionList,
    endpoint: `${event.url.origin}/api/bench-device`
  };
};
export const actions: Actions = {
  create: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const session = String(form.get('sessionId') ?? '');
    const name = String(form.get('name') ?? '').trim();
    if (!uuid(session) || !name || name.length > 60 || form.get('testOnly') !== 'yes')
      return fail(400, {
        ok: false,
        message: 'Choose a session, name the device and confirm test use.'
      });
    // Bind the route club as well as the RPC's admin check.
    const detail = await client.rpc('training_session_detail', { p_id: session });
    if (detail.error || detail.data.session.club_id !== event.params.clubId)
      return fail(400, { ok: false, message: 'Choose a planned session from this club.' });
    const { token, hash } = newBenchToken();
    const { data, error: problem } = await client.rpc('create_bench_device', {
      p_session_id: session,
      p_name: name,
      p_token_hash: hash
    });
    if (problem)
      return fail(400, {
        ok: false,
        message:
          'Unable to create credential. Check access, session status and the 20-device limit.'
      });
    return {
      ok: true,
      message: 'Test credential created. Copy it now; only its hash is stored.',
      credential: `${data}.${token}`
    };
  },
  revoke: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const id = String((await event.request.formData()).get('deviceId') ?? '');
    if (!uuid(id)) return fail(400, { ok: false, message: 'Invalid device.' });
    const { error: problem } = await client.rpc('revoke_bench_device', { p_id: id });
    return problem
      ? fail(400, { ok: false, message: 'Unable to revoke device.' })
      : { ok: true, message: 'Test credential revoked.' };
  }
};
