import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from './access';
import type { ShellData, Workspace } from '#lib/workspaces';

/**
 * Data for the signed-in app shell. The workspace list only drives the
 * account menu; every page still checks its own permissions. A failed lookup
 * degrades to an empty menu rather than blocking a page the user may open.
 */
export async function shellData(event: RequestEvent, currentKey: string | null) {
  const { client, user } = requireUser(event);
  let workspaces: Workspace[] = [];
  const { data, error } = await client.rpc('my_workspaces');
  if (!error && Array.isArray(data)) workspaces = data as Workspace[];
  const shell: ShellData = { email: user.email ?? '', workspaces, currentKey };
  return { shell };
}
