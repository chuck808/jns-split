import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin, messageForDatabaseError } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { riderSettingsFromForm, type RiderSettings } from '#lib/rider-details';

export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const { data, error: problem } = await client.rpc('rider_settings', {
    p_club_id: event.params.clubId
  });
  if (problem)
    error(503, 'Unable to load rider settings. Apply the rider details migration (011) first.');
  return { riderSettings: data as RiderSettings };
};

export const actions: Actions = {
  club: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    const unit = String(form.get('unit') ?? '');
    if (!name || name.length > 100 || !['km/h', 'mph'].includes(unit))
      return fail(400, {
        section: 'club',
        message: 'Enter a club name of 1–100 characters and a supported speed unit.',
        ok: false
      });
    const { error } = await client.rpc('update_club_settings', {
      p_club_id: event.params.clubId,
      p_name: name,
      p_speed_unit: unit
    });
    if (error)
      return fail(400, {
        section: 'club',
        message: messageForDatabaseError(error.code),
        ok: false
      });
    return { section: 'club', message: 'Club details saved.', ok: true };
  },
  riders: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const parsed = riderSettingsFromForm(await event.request.formData());
    if (!parsed.ok) return fail(400, { section: 'riders', message: parsed.message, ok: false });
    const { error } = await client.rpc('update_rider_settings', {
      p_club_id: event.params.clubId,
      p_age_rule: parsed.value.age_rule,
      p_guardian_only_under: parsed.value.guardian_only_under,
      p_rider_from: parsed.value.rider_from,
      p_scoreboard_name: parsed.value.scoreboard_name
    });
    if (error)
      return fail(400, {
        section: 'riders',
        message: messageForDatabaseError(error.code),
        ok: false
      });
    return { section: 'riders', message: 'Rider settings saved.', ok: true };
  },
  field: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('fieldId') ?? '');
    const label = String(form.get('label') ?? '').trim();
    if (id && !uuid(id))
      return fail(400, { section: 'fields', message: 'Field not found.', ok: false });
    if (!label || label.length > 60)
      return fail(400, {
        section: 'fields',
        message: 'Give the field a name of 1–60 characters.',
        ok: false
      });
    const { error } = await client.rpc('save_rider_field', {
      p_club_id: event.params.clubId,
      p_field_id: id || null,
      p_label: label,
      p_required: form.get('required') === 'yes'
    });
    if (error)
      return fail(400, {
        section: 'fields',
        message:
          error.code === '23514'
            ? 'A club can have up to two extra fields. Remove one first.'
            : messageForDatabaseError(error.code),
        ok: false
      });
    return { section: 'fields', message: 'Field saved.', ok: true };
  },
  removeField: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('fieldId') ?? '');
    if (!uuid(id)) return fail(400, { section: 'fields', message: 'Field not found.', ok: false });
    if (form.get('confirm') !== 'yes')
      return fail(400, { section: 'fields', message: 'Tick the box to confirm.', ok: false });
    const { error } = await client.rpc('remove_rider_field', { p_field_id: id });
    if (error)
      return fail(400, {
        section: 'fields',
        message: messageForDatabaseError(error.code),
        ok: false
      });
    return {
      section: 'fields',
      message: 'Field removed. Values already recorded are kept but no longer shown.',
      ok: true
    };
  }
};
