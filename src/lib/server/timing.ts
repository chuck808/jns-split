import { uuid } from '#lib/coaches';
import { normalizeUid } from '#lib/session';

/** Results upload v1: one measured effort from a timing controller. */
export const OUTCOMES = ['completed', 'dnf', 'cancelled', 'invalid'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function effortInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid effort');
  const v = value as Record<string, unknown>;
  const outcome = v.outcome as Outcome;
  if (
    v.version !== 1 ||
    typeof v.resultId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(v.resultId) ||
    typeof v.sessionId !== 'string' ||
    !uuid(v.sessionId) ||
    !Number.isInteger(v.lane) ||
    (v.lane as number) < 1 ||
    (v.lane as number) > 4 ||
    typeof v.uid !== 'string' ||
    !OUTCOMES.includes(outcome)
  )
    throw new Error('Invalid effort');
  const completed = outcome === 'completed';
  if (completed) {
    if (
      !Number.isInteger(v.elapsedMs) ||
      (v.elapsedMs as number) < 1 ||
      (v.elapsedMs as number) > 600000
    )
      throw new Error('elapsedMs required');
  } else if (v.elapsedMs !== undefined && v.elapsedMs !== null)
    throw new Error('No time for this outcome');
  return {
    p_result_id: v.resultId,
    p_session_id: v.sessionId,
    p_lane: v.lane as number,
    p_uid: normalizeUid(v.uid),
    p_outcome: outcome,
    p_elapsed_ms: completed ? (v.elapsedMs as number) : null
  };
}

/** HTTP status for each decision, so a controller knows whether to retry. */
export function effortStatus(code: string): number {
  if (code === 'SAVED') return 200;
  if (code === 'RESULT_ID_CONFLICT') return 409;
  return 422; // A decision about this effort: retrying unchanged won't help.
}

/** Device-safe text: no control characters, bounded length. */
export const deviceText = (value: unknown) =>
  String(value ?? '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .slice(0, 60);
