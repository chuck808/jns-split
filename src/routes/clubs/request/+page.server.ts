import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid } from '#lib/coaches';
import { admissionError, applicationFilters, type ApplicationList } from '#lib/club-admission';
export const load: PageServerLoad = async (event) => {
  const { client, user } = requireUser(event);
  const filters = applicationFilters(event.url.searchParams);
  const { data, error: problem } = await client.rpc('list_club_applications', {
    p_platform: false,
    p_status: filters.status,
    p_page: filters.page
  });
  if (problem) error(503, 'Unable to load your applications. Try again, or contact the pilot administrator.');
  return {
    list: data as ApplicationList,
    filters,
    email: user.email ?? '',
    verified: !!user.email_confirmed_at,
    requestId: randomUUID()
  };
};
export const actions: Actions = {
  default: async (event) => {
    const { client } = requireUser(event);
    const form = await event.request.formData();
    const draft = {
      requestId: String(form.get('requestId') ?? ''),
      clubName: String(form.get('clubName') ?? '').trim(),
      town: String(form.get('town') ?? '').trim(),
      applicantName: String(form.get('applicantName') ?? '').trim(),
      authorised: form.get('authorised') === 'yes'
    };
    if (
      !uuid(draft.requestId) ||
      !draft.authorised ||
      [draft.clubName, draft.town, draft.applicantName].some((v) => !v || v.length > 100)
    )
      return fail(400, {
        message:
          'Enter your name, club name and town/region (up to 100 characters each), and confirm you are authorised to apply.',
        draft
      });
    const { data, error: problem } = await client.rpc('submit_club_application', {
      p_request_id: draft.requestId,
      p_club_name: draft.clubName,
      p_town: draft.town,
      p_applicant_name: draft.applicantName,
      p_authorised: draft.authorised
    });
    if (problem) return fail(400, { message: admissionError(problem.code), draft });
    redirect(303, `/clubs/applications/${data}`);
  }
};
