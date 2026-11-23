import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from './access';
import type { Workspace } from '#lib/workspaces';
export async function loadWorkspaces(event: RequestEvent) {
  const { client, user } = requireUser(event);
  const { data, error: problem } = await client.rpc('my_workspaces');
  if (problem) error(503, 'Unable to load your workspaces. Check migration 009 and try again.');
  return { user, items: data as Workspace[] };
}
