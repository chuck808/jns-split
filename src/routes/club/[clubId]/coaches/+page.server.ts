import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
import { coachError, emailAddress, uuid, type ClubCoaches } from '#lib/coaches';
import { rosterFilters } from '#lib/club-workspace';
export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const page = rosterFilters(event.url.searchParams).page;
  const invitePage = rosterFilters(
    new URLSearchParams({ page: event.url.searchParams.get('invites') ?? '1' })
  ).page;
  const { data, error: problem } = await client.rpc('club_coaches', {
    p_club_id: event.params.clubId,
    p_page: page,
    p_invite_page: invitePage
  });
  if (problem)
    error(503, 'Unable to load coaches. Apply the coach invitations migration and try again.');
  return { directory: data as ClubCoaches };
};
export const actions: Actions = {
  invite: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const email = emailAddress((await event.request.formData()).get('email'));
    if (!email) return fail(400, { message: 'Enter a valid coach email address.', ok: false });
    const { error } = await client.rpc('invite_coach', {
      p_club_id: event.params.clubId,
      p_email: email
    });
    if (error) return fail(400, { message: coachError(error.code), ok: false });
    return {
      message:
        'Invitation created. No email has been sent. Ask the coach to sign in (or create an account at /signup) with that address and open Coach within seven days.',
      ok: true
    };
  },
  revoke: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const id = String((await event.request.formData()).get('invitationId') ?? '');
    if (!uuid(id)) return fail(400, { message: 'Invalid invitation.', ok: false });
    const { error } = await client.rpc('revoke_coach_invitation', {
      p_club_id: event.params.clubId,
      p_invitation_id: id
    });
    if (error) return fail(400, { message: coachError(error.code), ok: false });
    return {
      message:
        'Pending invitation revoked. An already accepted membership must be removed separately.',
      ok: true
    };
  },
  remove: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    const form = await event.request.formData();
    const id = String(form.get('userId') ?? '');
    if (!uuid(id) || form.get('confirm') !== 'yes')
      return fail(400, { message: 'Confirm the coach membership removal.', ok: false });
    const { error } = await client.rpc('remove_coach', {
      p_club_id: event.params.clubId,
      p_user_id: id
    });
    if (error) return fail(400, { message: coachError(error.code), ok: false });
    return {
      message: 'Coach removed from this club. Their account and other club links remain.',
      ok: true
    };
  }
};
