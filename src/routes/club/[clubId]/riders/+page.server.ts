import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin, messageForDatabaseError } from '#lib/server/access';
import { normalizeUid } from '#lib/session';
import { rosterFilters, type Roster } from '#lib/club-workspace';
export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const filters = rosterFilters(event.url.searchParams);
  const { data, error: problem } = await client.rpc('club_roster', {
    p_club_id: event.params.clubId,
    p_query: filters.query,
    p_status: filters.status,
    p_page: filters.page
  });
  if (problem)
    error(503, 'Unable to load riders. Check the club workspace migration has been applied.');
  return { ...(data as Roster), filters };
};
export const actions: Actions = {
  register: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    const rawUid = String(form.get('uid') ?? '').trim();
    if (!name || name.length > 60)
      return fail(400, { message: 'Enter a rider display name of 1–60 characters.', ok: false });
    let uid: string | null = null;
    try {
      if (rawUid) uid = normalizeUid(rawUid);
    } catch {
      return fail(400, {
        message: 'Enter the complete tag UID, or leave it blank to issue a tag later.',
        ok: false
      });
    }
    const { error } = await client.rpc('register_rider', {
      p_club_id: event.params.clubId,
      p_name: name,
      p_uid: uid
    });
    if (error) return fail(400, { message: messageForDatabaseError(error.code), ok: false });
    return { message: 'Rider registered and saved to the club.', ok: true };
  },
  tag: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const { data: rider } = await client
      .from('riders')
      .select('id')
      .eq('id', id)
      .eq('club_id', event.params.clubId)
      .maybeSingle();
    if (!rider) return fail(400, { message: 'Rider not found in this club.', ok: false });
    let uid: string;
    try {
      uid = normalizeUid(String(form.get('uid') ?? ''));
    } catch {
      return fail(400, {
        message: 'Enter the complete 4, 7 or 10 byte hexadecimal UID.',
        ok: false
      });
    }
    const { error } = await client.rpc('set_rider_tag', { p_rider_id: id, p_uid: uid });
    if (error) return fail(400, { message: messageForDatabaseError(error.code), ok: false });
    return { message: 'Tag saved. Any previous active tag has been retired.', ok: true };
  },
  revoke: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const { data: rider } = await client
      .from('riders')
      .select('id')
      .eq('id', id)
      .eq('club_id', event.params.clubId)
      .maybeSingle();
    if (!rider) return fail(400, { message: 'Rider not found in this club.', ok: false });
    const { error } = await client.rpc('revoke_rider_tag', { p_rider_id: id });
    if (error) return fail(400, { message: messageForDatabaseError(error.code), ok: false });
    return { message: 'Tag revoked. The rider and tag history are retained.', ok: true };
  },
  archive: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    if (form.get('confirm') !== 'yes')
      return fail(400, {
        message: 'Confirm archiving the rider and revoking their tag.',
        ok: false
      });
    const { data: rider } = await client
      .from('riders')
      .select('id')
      .eq('id', id)
      .eq('club_id', event.params.clubId)
      .maybeSingle();
    if (!rider) return fail(400, { message: 'Rider not found in this club.', ok: false });
    const { error } = await client.rpc('archive_rider', { p_rider_id: id });
    if (error) return fail(400, { message: messageForDatabaseError(error.code), ok: false });
    return {
      message: 'Rider archived. Their active tag has been revoked and history retained.',
      ok: true
    };
  }
};
