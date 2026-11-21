import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid, type ClubCoaches } from '#lib/coaches';
import {
  participantFilters,
  participantError,
  type ParticipantPage,
  type CandidatePage
} from '#lib/session-participants';
import {
  sessionFilters,
  sessionInput,
  sessionError,
  type SessionDetail
} from '#lib/training-sessions';
export const load: PageServerLoad = async (event) => {
  const { client } = requireUser(event);
  if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
  const { data, error: problem } = await client.rpc('training_session_detail', {
    p_id: event.params.sessionId
  });
  if (problem)
    error(problem.code === '42501' ? 404 : 503, 'Session unavailable or access removed.');
  const detail = data as SessionDetail;
  let directory: ClubCoaches | null = null;
  if (detail.isAdmin) {
    const page = sessionFilters(
      new URLSearchParams({ page: event.url.searchParams.get('coachesPage') ?? '1' })
    ).page;
    const result = await client.rpc('club_coaches', {
      p_club_id: detail.session.club_id,
      p_page: page,
      p_invite_page: 1
    });
    if (result.error) error(503, 'Unable to load approved coaches.');
    directory = result.data as ClubCoaches;
  }
  const filters = participantFilters(event.url.searchParams);
  const participantResult = await client.rpc('list_session_participants', {
    p_session_id: event.params.sessionId,
    p_page: filters.participantsPage
  });
  if (participantResult.error)
    error(
      participantResult.error.code === '42501' ? 404 : 503,
      'Unable to load session participants. Check migration 005 or refresh if access has changed.'
    );
  let candidates: CandidatePage | null = null;
  if (detail.isAdmin && detail.session.status === 'planned') {
    const result = await client.rpc('session_participant_candidates', {
      p_session_id: event.params.sessionId,
      p_query: filters.query,
      p_page: filters.candidatesPage
    });
    if (result.error)
      error(
        result.error.code === '42501' ? 404 : 503,
        'Unable to load eligible riders. Refresh if the session has closed.'
      );
    candidates = result.data as CandidatePage;
  }
  return {
    detail,
    directory,
    participants: participantResult.data as ParticipantPage,
    candidates,
    participantFilters: filters
  };
};
export const actions: Actions = {
  addParticipant: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const version = Number(form.get('version'));
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1)
      return fail(400, { message: 'Choose a valid rider and refresh the session.', ok: false });
    const { error: problem } = await client.rpc('add_session_participant', {
      p_session_id: event.params.sessionId,
      p_rider_id: id,
      p_version: version
    });
    if (problem) return fail(400, { message: participantError(problem.code), ok: false });
    return {
      message: 'Rider is on the session participant list. No lane has been assigned.',
      ok: true
    };
  },
  removeParticipant: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    const id = String(form.get('riderId') ?? '');
    const version = Number(form.get('version'));
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1)
      return fail(400, {
        message: 'Choose a valid participant and refresh the session.',
        ok: false
      });
    const { error: problem } = await client.rpc('remove_session_participant', {
      p_session_id: event.params.sessionId,
      p_rider_id: id,
      p_version: version
    });
    if (problem) return fail(400, { message: participantError(problem.code), ok: false });
    return {
      message: 'Rider removed from this session. Their club registration and tag are unchanged.',
      ok: true
    };
  },
  update: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    let input;
    try {
      input = sessionInput(form);
    } catch (e) {
      return fail(400, { message: (e as Error).message, ok: false });
    }
    const { error: problem } = await client.rpc('update_training_session', {
      p_id: event.params.sessionId,
      p_version: Number(form.get('version')),
      ...input
    });
    if (problem) return fail(400, { message: sessionError(problem.code), ok: false });
    return { message: 'Session plan updated.', ok: true };
  },
  finish: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    const status = String(form.get('status') ?? '');
    if (form.get('confirm') !== 'yes' || !['closed', 'cancelled'].includes(status))
      return fail(400, { message: 'Confirm closing or cancelling this session.', ok: false });
    const { error: problem } = await client.rpc('finish_training_session', {
      p_id: event.params.sessionId,
      p_version: Number(form.get('version')),
      p_status: status
    });
    if (problem) return fail(400, { message: sessionError(problem.code), ok: false });
    return { message: `Session ${status}. No measured results were created.`, ok: true };
  },
  assign: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    const id = String(form.get('userId') ?? '');
    if (!uuid(id)) return fail(400, { message: 'Choose an approved coach.', ok: false });
    const { error: problem } = await client.rpc('assign_session_coach', {
      p_id: event.params.sessionId,
      p_user_id: id,
      p_can_manage: form.get('manage') === 'yes'
    });
    if (problem) return fail(400, { message: sessionError(problem.code), ok: false });
    return { message: 'Session permission saved.', ok: true };
  },
  remove: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const id = String((await event.request.formData()).get('userId') ?? '');
    if (!uuid(id)) return fail(400, { message: 'Choose a session coach.', ok: false });
    const { error: problem } = await client.rpc('remove_session_coach', {
      p_id: event.params.sessionId,
      p_user_id: id
    });
    if (problem) return fail(400, { message: sessionError(problem.code), ok: false });
    return { message: 'Coach access to this session removed.', ok: true };
  }
};
