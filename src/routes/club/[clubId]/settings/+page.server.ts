import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { requireAdmin, messageForDatabaseError } from '#lib/server/access';
export const actions: Actions = {
  default: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();
    const unit = String(form.get('unit') ?? '');
    if (!name || name.length > 100 || !['km/h', 'mph'].includes(unit))
      return fail(400, {
        message: 'Enter a club name of 1–100 characters and a supported speed unit.',
        ok: false
      });
    const { error } = await client.rpc('update_club_settings', {
      p_club_id: event.params.clubId,
      p_name: name,
      p_speed_unit: unit
    });
    if (error) return fail(400, { message: messageForDatabaseError(error.code), ok: false });
    return { message: 'Club settings saved.', ok: true };
  }
};
