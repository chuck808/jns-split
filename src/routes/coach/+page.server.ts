import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { coachError, uuid, type CoachWorkspace } from '#lib/coaches';
export const load: PageServerLoad = async (event) => {
  const { client, user } = requireUser(event);
  const { data, error: problem } = await client.rpc('my_coach_workspace');
  if (problem)
    error(503, 'Unable to load your coach workspace. Check the coach invitations migration.');
  return { workspace: data as CoachWorkspace, email: user.email ?? '' };
};
export const actions: Actions = {
  default: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const id = String(form.get('invitationId') ?? '');
    const choice = String(form.get('choice') ?? '');
    if (!uuid(id) || !['accept', 'decline'].includes(choice))
      return fail(400, { message: 'Choose a valid invitation and response.', ok: false });
    const { error } = await client.rpc('respond_coach_invitation', {
      p_invitation_id: id,
      p_accept: choice === 'accept'
    });
    if (error) return fail(400, { message: coachError(error.code), ok: false });
    return {
      message:
        choice === 'accept'
          ? 'Club invitation accepted. Session and rider access require separate permissions.'
          : 'Invitation declined.',
      ok: true
    };
  }
};
