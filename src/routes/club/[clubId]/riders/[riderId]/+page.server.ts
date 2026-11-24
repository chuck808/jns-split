import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireAdmin } from '#lib/server/access';
import { emailAddress, uuid } from '#lib/coaches';
import { familyError, isKind, type RiderAccess } from '#lib/family';

async function admin(event: RequestEvent) {
  const { client } = await requireAdmin(event, event.params.clubId);
  if (!uuid(event.params.riderId)) error(404, 'Rider not found.');
  return client;
}
async function idFrom(event: RequestEvent, field: string) {
  const id = String((await event.request.formData()).get(field) ?? '');
  return uuid(id) ? id : null;
}

export const load: PageServerLoad = async (event) => {
  const client = await admin(event);
  const { data, error: problem } = await client.rpc('rider_access', {
    p_rider_id: event.params.riderId
  });
  if (problem?.code === '42501') error(404, 'Rider not found.');
  if (problem)
    error(503, 'Unable to load family access. Apply the family access migration (012) first.');
  return { access: data as RiderAccess };
};

export const actions: Actions = {
  invite: async (event) => {
    const client = await admin(event);
    const form = await event.request.formData();
    const email = emailAddress(form.get('email'));
    const kind = form.get('kind');
    if (!email) return fail(400, { message: 'Enter a valid email address.', ok: false });
    if (!isKind(kind)) return fail(400, { message: 'Choose who you’re inviting.', ok: false });
    if (form.get('checked') !== 'yes')
      return fail(400, {
        message: 'Tick that your club’s own permissions check is done.',
        ok: false
      });
    const { error } = await client.rpc('invite_rider_access', {
      p_rider_id: event.params.riderId,
      p_email: email,
      p_kind: kind,
      p_checked: true
    });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return {
      message: `Invitation created for ${email}. No email is sent yet: ask them to sign in with that address within seven days.`,
      ok: true
    };
  },
  renew: async (event) => {
    const client = await admin(event);
    const id = await idFrom(event, 'invitationId');
    if (!id) return fail(400, { message: 'Invalid invitation.', ok: false });
    const { error } = await client.rpc('renew_rider_invitation', { p_invitation_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Invitation renewed for seven more days.', ok: true };
  },
  revoke: async (event) => {
    const client = await admin(event);
    const id = await idFrom(event, 'invitationId');
    if (!id) return fail(400, { message: 'Invalid invitation.', ok: false });
    const { error } = await client.rpc('revoke_rider_invitation', { p_invitation_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Invitation withdrawn.', ok: true };
  },
  unlink: async (event) => {
    const client = await admin(event);
    const form = await event.request.formData();
    const id = String(form.get('linkId') ?? '');
    if (!uuid(id) || form.get('confirm') !== 'yes')
      return fail(400, { message: 'Confirm removing this access.', ok: false });
    const { error } = await client.rpc('remove_rider_link', { p_link_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return {
      message: 'Access removed. Their account and any other riders linked to them are unchanged.',
      ok: true
    };
  },
  resolve: async (event) => {
    const client = await admin(event);
    const id = await idFrom(event, 'requestId');
    if (!id) return fail(400, { message: 'Invalid request.', ok: false });
    const { error } = await client.rpc('resolve_rider_correction', { p_request_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    return { message: 'Request marked as dealt with.', ok: true };
  }
};
