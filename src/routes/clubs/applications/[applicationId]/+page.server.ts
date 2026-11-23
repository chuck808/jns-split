import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { admissionError, type ApplicationDetail } from '#lib/club-admission';
export const load: PageServerLoad = async (event) => {
  const { client } = requireUser(event);
  if (!uuid(event.params.applicationId)) error(404, 'Application unavailable.');
  const { data, error: problem } = await client.rpc('club_application_detail', {
    p_id: event.params.applicationId
  });
  if (problem) error(problem.code === '42501' ? 404 : 503, 'Application unavailable.');
  return { detail: data as ApplicationDetail };
};
export const actions: Actions = {
  withdraw: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.applicationId)) error(404, 'Application unavailable.');
    if ((await event.request.formData()).get('confirm') !== 'yes')
      return fail(400, { ok: false, message: 'Confirm withdrawing the application.' });
    const { error: problem } = await client.rpc('withdraw_club_application', {
      p_id: event.params.applicationId
    });
    return problem
      ? fail(400, { ok: false, message: admissionError(problem.code) })
      : { ok: true, message: 'Application withdrawn.' };
  }
};
