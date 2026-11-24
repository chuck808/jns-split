import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { newBenchToken } from '#lib/server/bench-device';
import { sessionFilters, type SessionList } from '#lib/training-sessions';

export interface TimingDevice {
  id: string;
  name: string;
  mode: 'test' | 'live';
  created_at: string;
  expires_at: string;
  last_seen_at: string | null;
  revoked: boolean;
  expired: boolean;
  efforts: number;
}

export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const devices = await client.rpc('list_timing_devices', { p_club_id: event.params.clubId });
  if (devices.error)
    error(
      503,
      'Unable to load timing controllers. Apply the recorded results migration (013) first.'
    );
  const sessions = await client.rpc('list_training_sessions', {
    p_club_id: event.params.clubId,
    p_status: 'planned',
    p_page: sessionFilters(event.url.searchParams).page
  });
  return {
    devices: devices.data as TimingDevice[],
    sessions: (sessions.error ? null : sessions.data) as SessionList | null,
    endpoint: `${event.url.origin}/api/timing/efforts`
  };
};

export const actions: Actions = {
  create: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    const mode = String(form.get('mode') ?? '');
    if (!name || name.length > 60 || !['test', 'live'].includes(mode))
      return fail(400, { ok: false, message: 'Name the controller and choose Test or Live.' });
    if (mode === 'live' && form.get('liveConfirm') !== 'yes')
      return fail(400, {
        ok: false,
        message: 'Confirm this Live credential is only for real timing equipment.'
      });
    const { token, hash } = newBenchToken();
    const { data, error: problem } = await client.rpc('create_timing_device', {
      p_club_id: event.params.clubId,
      p_name: name,
      p_mode: mode,
      p_token_hash: hash
    });
    if (problem)
      return fail(400, {
        ok: false,
        message:
          problem.code === '23514'
            ? 'You already have 20 active controllers. Revoke one you no longer use.'
            : 'The credential couldn’t be created. Check you’re still an admin of this club.'
      });
    return {
      ok: true,
      message: 'Credential created. Copy it now: it is shown only once.',
      credential: `${data}.${token}`,
      mode
    };
  },
  revoke: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const id = String((await event.request.formData()).get('deviceId') ?? '');
    if (!uuid(id)) return fail(400, { ok: false, message: 'Invalid controller.' });
    const { error: problem } = await client.rpc('revoke_timing_device', { p_id: id });
    return problem
      ? fail(400, { ok: false, message: 'The credential couldn’t be revoked.' })
      : {
          ok: true,
          message: 'Credential revoked. Results it already saved are kept.'
        };
  }
};
