import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin, messageForDatabaseError } from '#lib/server/access';
import { normalizeUid } from '#lib/session';
import { rosterFilters, type Roster } from '#lib/club-workspace';
import { riderDetailsFromForm, type RiderSettings } from '#lib/rider-details';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

async function loadSettings(client: SupabaseClient, clubId: string) {
  const { data, error: problem } = await client.rpc('rider_settings', { p_club_id: clubId });
  if (problem)
    error(503, 'Unable to load rider settings. Apply the rider details migration (011) first.');
  return data as RiderSettings;
}
const detailsMessage = (code: string) =>
  code === '22023'
    ? 'Check the name, year or date of birth, and any required fields.'
    : messageForDatabaseError(code);
async function clubRider(client: SupabaseClient, event: RequestEvent, id: string) {
  const { data } = await client!
    .from('riders')
    .select('id')
    .eq('id', id)
    .eq('club_id', event.params.clubId!)
    .maybeSingle();
  return !!data;
}
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
  const riderSettings = await loadSettings(client, event.params.clubId);
  const roster = data as Roster;
  return { ...roster, fieldValues: roster.fieldValues ?? [], filters, riderSettings };
};
export const actions: Actions = {
  register: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    const rawUid = String(form.get('uid') ?? '').trim();
    if (!name || name.length > 60)
      return fail(400, { message: 'Enter a rider display name of 1–60 characters.', ok: false });
    const details = riderDetailsFromForm(form, await loadSettings(client, event.params.clubId));
    if (!details.ok) return fail(400, { message: details.message, ok: false });
    let uid: string | null = null;
    try {
      if (rawUid) uid = normalizeUid(rawUid);
    } catch {
      return fail(400, {
        message: 'Enter the complete tag UID, or leave it blank to issue a tag later.',
        ok: false
      });
    }
    const { error } = await client.rpc('register_rider_with_details', {
      p_club_id: event.params.clubId,
      p_name: name,
      p_birth_year: details.value.birthYear,
      p_birth_date: details.value.birthDate,
      p_fields: details.value.fields,
      p_uid: uid
    });
    if (error) return fail(400, { message: detailsMessage(error.code), ok: false });
    return {
      message: uid
        ? `${name} is registered and their tag works straight away.`
        : `${name} is registered. Give them a tag with Manage.`,
      ok: true
    };
  },
  details: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const name = String(form.get('name') ?? '').trim();
    if (!(await clubRider(client, event, id)))
      return fail(400, { message: 'Rider not found in this club.', ok: false });
    if (!name || name.length > 60)
      return fail(400, { message: 'Enter a rider display name of 1–60 characters.', ok: false });
    const details = riderDetailsFromForm(form, await loadSettings(client, event.params.clubId));
    if (!details.ok) return fail(400, { message: details.message, ok: false });
    const { error } = await client.rpc('update_rider_details', {
      p_rider_id: id,
      p_name: name,
      p_birth_year: details.value.birthYear,
      p_birth_date: details.value.birthDate,
      p_fields: details.value.fields
    });
    if (error) return fail(400, { message: detailsMessage(error.code), ok: false });
    return { message: `${name}’s details are saved.`, ok: true };
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
