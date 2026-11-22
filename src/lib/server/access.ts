import { error, redirect, type RequestEvent } from '@sveltejs/kit';
export function requireUser(event: RequestEvent) {
  if (!event.locals.supabase)
    error(503, 'Club storage is not configured. The bench simulator is still available.');
  if (!event.locals.user) redirect(303, '/login');
  return { client: event.locals.supabase, user: event.locals.user };
}
export async function requireAdmin(event: RequestEvent, clubId: string) {
  const { client, user } = requireUser(event);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clubId))
    error(404, 'Club not found.');
  const { data, error: queryError } = await client
    .from('club_membership_roles')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (queryError) error(503, 'Unable to check club access. Please try again.');
  if (data?.role !== 'admin') error(404, 'Club not found.');
  return { client, user };
}
export function messageForDatabaseError(code: string): string {
  if (code === '23505')
    return 'That tag is already assigned, or this account already has a club. No changes were saved.';
  if (code === '42501') return 'Your club access has changed. Please sign in again.';
  if (code === '22023' || code === '23514')
    return 'Check the name and full tag UID. Archived riders cannot receive tags.';
  return 'The change could not be saved. Please try again.';
}
