import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { familyError, type RiderWorkspace } from '#lib/family';
import { SCOREBOARD_NAMES } from '#lib/rider-details';
import type { RiderResults } from '#lib/results';

export const load: PageServerLoad = async (event) => {
  const { client } = requireUser(event);
  const { data, error: problem } = await client.rpc('my_rider_workspace');
  if (problem)
    error(503, 'Unable to load riders. Apply the family access migration (012) and try again.');
  const workspace = data as RiderWorkspace;
  const wanted = event.url.searchParams.get('rider');
  const selected =
    workspace.riders.find((r) => r.rider_id === wanted) ?? workspace.riders[0] ?? null;
  let results: RiderResults | null = null;
  if (selected) {
    // Before migration 013 there are simply no results yet.
    const r = await client.rpc('rider_results', { p_rider_id: selected.rider_id });
    if (!r.error) results = r.data as RiderResults;
  }
  let erasure: { status: string; created_at: string; decline_reason: string | null } | null = null;
  if (selected) {
    // Before migration 020 there's simply no request to show.
    const q = await client.rpc('my_erasure_request', { p_rider_id: selected.rider_id });
    if (!q.error) erasure = q.data;
  }
  return { workspace, selected, results, erasure };
};

export const actions: Actions = {
  respond: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('invitationId') ?? '');
    const choice = String(form.get('choice') ?? '');
    if (!uuid(id) || !['accept', 'decline'].includes(choice))
      return fail(400, { message: 'Choose a valid invitation and response.', ok: false });
    const { error } = await client.rpc('respond_rider_invitation', {
      p_invitation_id: id,
      p_accept: choice === 'accept'
    });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return {
      message: choice === 'accept' ? 'Invitation accepted.' : 'Invitation declined.',
      ok: true
    };
  },
  scoreboard: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const choice = String(form.get('scoreboardName') ?? '');
    if (!uuid(id) || !SCOREBOARD_NAMES.some((n) => n.value === choice))
      return fail(400, { message: 'Choose how the name should appear.', ok: false });
    const { error } = await client.rpc('set_rider_scoreboard_name', {
      p_rider_id: id,
      p_choice: choice
    });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Scoreboard name saved.', ok: true };
  },
  correction: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const message = String(form.get('message') ?? '').trim();
    if (!uuid(id) || !message || message.length > 500)
      return fail(400, {
        message: 'Write what needs correcting, in up to 500 characters.',
        ok: false
      });
    const { error } = await client.rpc('request_rider_correction', {
      p_rider_id: id,
      p_message: message
    });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Sent to the club. They’ll make the change.', ok: true };
  },
  erasure: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const message = String(form.get('message') ?? '').trim();
    if (!uuid(id) || form.get('understand') !== 'yes')
      return fail(400, {
        message: 'Tick that you understand what erasure means before sending.',
        ok: false
      });
    if (message.length > 500)
      return fail(400, { message: 'Keep the message to 500 characters.', ok: false });
    const { error } = await client.rpc('request_rider_erasure', {
      p_rider_id: id,
      p_message: message || null
    });
    if (error)
      return fail(400, {
        message:
          error.code === '23505'
            ? 'You’ve already asked. The club will be in touch.'
            : familyError(error.code),
        ok: false
      });
    return {
      message: 'Request sent. A club admin will check it and erase the data, or tell you why not.',
      ok: true
    };
  },
  leave: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('linkId') ?? '');
    if (!uuid(id) || form.get('confirm') !== 'yes')
      return fail(400, { message: 'Confirm you want to stop seeing this rider.', ok: false });
    const { error } = await client.rpc('remove_rider_link', { p_link_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Done. You no longer see that rider.', ok: true };
  }
};
