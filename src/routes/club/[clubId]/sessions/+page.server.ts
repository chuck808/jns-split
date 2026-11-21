import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
import {
  sessionFilters,
  sessionInput,
  sessionError,
  type SessionList
} from '#lib/training-sessions';
export const load: PageServerLoad = async (event) => {
  const { client } = await requireAdmin(event, event.params.clubId);
  const filters = sessionFilters(event.url.searchParams);
  const { data, error: problem } = await client.rpc('list_training_sessions', {
    p_club_id: event.params.clubId,
    p_status: filters.status,
    p_page: filters.page
  });
  if (problem) error(503, 'Unable to load sessions. Check the session planning migration.');
  return { list: data as SessionList, filters };
};
export const actions: Actions = {
  default: async (event) => {
    const { client } = await requireAdmin(event, event.params.clubId);
    let input;
    try {
      input = sessionInput(await event.request.formData());
    } catch (e) {
      return fail(400, { message: (e as Error).message });
    }
    const { data, error } = await client.rpc('create_training_session', {
      p_club_id: event.params.clubId,
      ...input
    });
    if (error) return fail(400, { message: sessionError(error.code) });
    redirect(303, `/sessions/${data}`);
  }
};
