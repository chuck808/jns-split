import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import type { CoachWorkspace } from '#lib/coaches';
export const load: PageServerLoad = async (event) => {
  if (!event.locals.backendReady) redirect(303, '/login');
  const { client, user } = requireUser(event);
  const { data: memberships, error: membershipError } = await client
    .from('club_membership_roles')
    .select('club_id,role');
  const { data: clubs, error: clubError } = await client
    .from('clubs')
    .select('id,name')
    .order('name');
  const { data: coachData, error: coachError } = await client.rpc('my_coach_workspace');
  const coach = coachData as CoachWorkspace | null;
  return {
    coachLinks: coach?.clubs.length ?? 0,
    coachInvitations: coach?.invitations.length ?? 0,
    email: user.email ?? '',
    clubs: clubs ?? [],
    hasMembership: !!memberships?.length,
    message:
      membershipError || clubError || coachError
        ? 'Unable to load clubs. Check the database setup and try again.'
        : ''
  };
};
