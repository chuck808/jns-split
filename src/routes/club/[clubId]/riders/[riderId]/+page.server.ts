import { error, fail, redirect } from '@sveltejs/kit';
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
interface ErasureRequest {
  id: string;
  rider_id: string;
  display_name: string;
  message: string | null;
  created_at: string;
  requested_by: string;
}
interface Mention {
  kind: string;
  text: string;
  session: string | null;
  about: string;
  at: string;
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
  // Before migration 020 these come back empty.
  const requests = await client.rpc('club_erasure_requests', { p_club_id: event.params.clubId });
  const erasureRequest =
    ((requests.error ? [] : requests.data) as ErasureRequest[]).find(
      (r) => r.rider_id === event.params.riderId
    ) ?? null;
  // ?erase=1 opens the erase step, which checks other riders' notes for this name.
  let mentions: Mention[] | null = null;
  if (event.url.searchParams.get('erase')) {
    const m = await client.rpc('erasure_mentions', { p_rider_id: event.params.riderId });
    mentions = m.error ? null : m.data;
  }
  return {
    access: data as RiderAccess,
    emailOn: !!event.locals.mailer,
    erasureRequest,
    mentions
  };
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
  declineErasure: async (event) => {
    const client = await admin(event);
    const form = await event.request.formData();
    const id = String(form.get('requestId') ?? '');
    const reason = String(form.get('reason') ?? '').trim();
    if (!uuid(id) || !reason || reason.length > 500)
      return fail(400, {
        message: 'Give the family a short reason (up to 500 characters).',
        ok: false
      });
    const { error: problem } = await client.rpc('decline_rider_erasure', {
      p_request_id: id,
      p_reason: reason
    });
    if (problem) return fail(400, { message: familyError(problem.code), ok: false });
    return { message: 'Request declined. The family can see your reason.', ok: true };
  },
  erase: async (event) => {
    const client = await admin(event);
    const form = await event.request.formData();
    const name = String(form.get('confirmName') ?? '');
    if (form.get('understand') !== 'yes')
      return fail(400, { message: 'Tick that you understand erasure can’t be undone.', ok: false });
    const { error: problem } = await client.rpc('erase_rider', {
      p_rider_id: event.params.riderId,
      p_confirm_name: name
    });
    if (problem)
      return fail(400, {
        message:
          problem.code === '22023'
            ? 'The name doesn’t match exactly, or this rider has already been erased. Nothing was changed.'
            : familyError(problem.code),
        ok: false
      });
    redirect(303, `/club/${event.params.clubId}/riders?erased=1`);
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
