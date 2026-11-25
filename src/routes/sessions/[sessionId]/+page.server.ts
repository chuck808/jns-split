import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/access';
import { uuid, type ClubCoaches } from '#lib/coaches';
import { correctionError, type CorrectionPanel, type SessionResultsData } from '#lib/results';
import {
  participantFilters,
  participantError,
  type ParticipantPage,
  type CandidatePage
} from '#lib/session-participants';
import {
  sessionFilters,
  sessionInput,
  sessionActivity,
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
  if (
    detail.isAdmin &&
    detail.session.status === 'planned' &&
    detail.session.activity !== 'free_ride'
  ) {
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
  // Before migration 013 there are no results to show.
  const results = await client.rpc('session_results', { p_session_id: event.params.sessionId });
  // ?correct=<effort id> opens the correction panel for one effort.
  let correction: CorrectionPanel | null = null;
  const correctId = event.url.searchParams.get('correct') ?? '';
  const effort = (results.data as SessionResultsData | null)?.efforts?.find(
    (e) => e.id === correctId
  );
  if (effort) {
    const [candidates, history] = await Promise.all([
      client.rpc('effort_move_candidates', { p_effort_id: effort.id }),
      client.rpc('effort_correction_history', { p_effort_id: effort.id })
    ]);
    if (!candidates.error && !history.error)
      correction = { effort, candidates: candidates.data, history: history.data };
  }
  return {
    detail,
    directory,
    results: (results.error ? null : results.data) as SessionResultsData | null,
    correction,
    participants: participantResult.data as ParticipantPage,
    candidates,
    participantFilters: filters
  };
};
export const actions: Actions = {
  activity: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    let activity;
    try {
      activity = sessionActivity(form.get('activity'));
    } catch (e) {
      return fail(400, { message: (e as Error).message, ok: false });
    }
    const version = Number(form.get('version'));
    if (!Number.isSafeInteger(version) || version < 1)
      return fail(400, { message: 'Refresh this session before saving.', ok: false });
    const { error: problem } = await client.rpc('set_session_activity', {
      p_id: event.params.sessionId,
      p_version: version,
      p_activity: activity
    });
    if (problem)
      return fail(400, {
        message:
          problem.code === '22023'
            ? 'The session must be planned with no participants before changing activity. Remove planned participants or create a new session.'
            : sessionError(problem.code),
        ok: false
      });
    return {
      message: 'Session activity saved. No live practice session has been opened.',
      ok: true
    };
  },
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
  correct: async (event) => {
    const { client } = requireUser(event);
    if (!uuid(event.params.sessionId)) error(404, 'Session not found.');
    const form = await event.request.formData();
    const effortId = String(form.get('effortId') ?? '');
    const action = String(form.get('action') ?? '');
    const riderId = String(form.get('riderId') ?? '');
    const reason = String(form.get('reason') ?? '').trim();
    if (!uuid(effortId) || !['invalid', 'move', 'restore'].includes(action))
      return fail(400, { message: 'Choose what to correct.', ok: false });
    if (action === 'move' && !uuid(riderId))
      return fail(400, { message: 'Choose the rider who actually rode.', ok: false });
    if (action !== 'restore' && !reason)
      return fail(400, { message: 'Give a short reason, so others know why.', ok: false });
    if (reason.length > 200)
      return fail(400, { message: 'Keep the reason to 200 characters.', ok: false });
    const { error: problem } = await client.rpc('correct_effort', {
      p_effort_id: effortId,
      p_action: action,
      p_rider_id: action === 'move' ? riderId : null,
      p_reason: reason || null
    });
    if (problem) return fail(400, { message: correctionError(problem.code), ok: false });
    redirect(303, `/sessions/${event.params.sessionId}?corrected=1#results`);
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
    return { message: `Session ${status}. It takes no more results.`, ok: true };
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
