import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePlatform } from '#lib/server/platform';
import { uuid } from '#lib/coaches';
import { admissionError, type ApplicationDetail } from '#lib/club-admission';
export const load: PageServerLoad = async (event) => {
  const { client } = await requirePlatform(event);
  if (!uuid(event.params.applicationId)) error(404, 'Application unavailable.');
  const { data, error: problem } = await client.rpc('club_application_detail', {
    p_id: event.params.applicationId
  });
  if (problem) error(problem.code === '42501' ? 404 : 503, 'Application unavailable.');
  return { detail: data as ApplicationDetail };
};
export const actions: Actions = {
  review: async (event) => {
    const { client } = await requirePlatform(event);
    if (!uuid(event.params.applicationId)) error(404, 'Application unavailable.');
    const form = await event.request.formData(),
      decision = String(form.get('decision') ?? ''),
      reason = String(form.get('reason') ?? '').trim();
    if (
      form.get('confirm') !== 'yes' ||
      !['approve', 'decline'].includes(decision) ||
      reason.length < 3 ||
      reason.length > 500
    )
      return fail(400, {
        ok: false,
        message: 'Choose a decision, provide a reason of 3–500 characters and confirm.',
        reason
      });
    const { error: problem } = await client.rpc('review_club_application', {
      p_id: event.params.applicationId,
      p_approve: decision === 'approve',
      p_reason: reason
    });
    return problem
      ? fail(400, { ok: false, message: admissionError(problem.code), reason })
      : {
          ok: true,
          message:
            decision === 'approve'
              ? 'Application approved. The applicant can now open their club workspace.'
              : 'Application declined. The applicant can view the decision reason.',
          reason: ''
        };
  }
};
