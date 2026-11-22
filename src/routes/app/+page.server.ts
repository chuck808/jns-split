import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadWorkspaces } from '#lib/server/workspaces';
import { rememberedWorkspace } from '#lib/workspaces';
export const load: PageServerLoad = async (event) => {
  const { user, items } = await loadWorkspaces(event);
  if (event.url.searchParams.get('choose') !== '1') {
    const remembered = rememberedWorkspace(event.cookies.get('workspace'), user.id, items);
    const selected = remembered ?? (items.length === 1 ? items[0] : undefined);
    if (selected) redirect(303, selected.href);
  }
  return { items, email: user.email ?? '' };
};
export const actions: Actions = {
  default: async (event) => {
    const { user, items } = await loadWorkspaces(event);
    const key = String((await event.request.formData()).get('workspace') ?? '');
    const selected = items.find((item) => item.key === key);
    if (!selected)
      return fail(400, {
        message: 'That workspace is no longer available. Refresh and choose again.'
      });
    event.cookies.set('workspace', `${user.id}|${selected.key}`, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: event.url.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 90
    });
    redirect(303, selected.href);
  }
};
