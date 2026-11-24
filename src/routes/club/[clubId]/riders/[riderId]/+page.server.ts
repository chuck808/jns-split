import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requireAdmin } from '#lib/server/access';
import { emailAddress, uuid } from '#lib/coaches';
import { familyError, isKind, type LinkKind, type RiderAccess } from '#lib/family';
import { invitationNotice, sendInvitation } from '#lib/server/mail';

async function admin(event: RequestEvent) {
  const { client } = await requireAdmin(event, event.params.clubId);
  if (!uuid(event.params.riderId)) error(404, 'Rider not found.');
  return client;
}
async function emailInvite(
  event: RequestEvent,
  client: Awaited<ReturnType<typeof admin>>,
  kind: LinkKind,
  email: string
) {
  if (!event.locals.mailer) return 'off' as const;
  const { data: club } = await client
    .from('clubs')
    .select('name')
    .eq('id', event.params.clubId)
    .single();
  return sendInvitation(event.locals.mailer, kind, club?.name ?? 'Your club', email);
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
  return { access: data as RiderAccess, emailOn: !!event.locals.mailer };
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
    const outcome = await emailInvite(event, client, kind, email);
    return { message: invitationNotice(outcome, email, 'Riders and family'), ok: true };
  },
  renew: async (event) => {
    const client = await admin(event);
    const id = await idFrom(event, 'invitationId');
    if (!id) return fail(400, { message: 'Invalid invitation.', ok: false });
    const { error } = await client.rpc('renew_rider_invitation', { p_invitation_id: id });
    if (error) return fail(400, { message: familyError(error.code), ok: false });
    if (!event.locals.mailer)
      return { message: 'Invitation renewed for seven more days.', ok: true };
    // Email the renewed invitation again, using the address and kind the club holds.
    const { data } = await client
      .from('rider_invitations')
      .select('email, kind')
      .eq('id', id)
      .single();
    const outcome = data ? await emailInvite(event, client, data.kind, data.email) : 'failed';
    return {
      message:
        outcome === 'sent'
          ? `Invitation renewed for seven more days and emailed again to ${data?.email}.`
          : 'Invitation renewed for seven more days, but the email couldn’t be sent. Let them know yourself.',
      ok: true
    };
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
