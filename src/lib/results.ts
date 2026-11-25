/** One saved effort as an admin or coach sees it (session_results RPC). */
export interface SessionEffort {
  id: string;
  rider_id: string;
  rider_name: string;
  lane: number;
  outcome: Outcome;
  elapsed_ms: number | null;
  is_test: boolean;
  recorded_at: string;
  /** Saved with the effort: never the session's current settings. */
  distance_metres: number;
  start_mode: string;
  /** Coach note: only sent to the session's coaches and club admins. */
  note?: string | null;
  /** Corrections (migration 019): the effort is shown as corrected; the original is kept. */
  corrected?: boolean;
  correction_reason?: string | null;
  /** Set when the effort was moved from the rider it was measured against. */
  original_rider_name?: string | null;
}
export interface CorrectionPanel {
  effort: SessionEffort;
  candidates: { rider_id: string; display_name: string }[];
  history: {
    seq: number;
    invalid: boolean;
    rider_name: string | null;
    reason: string;
    created_at: string;
    by_email: string;
  }[];
}
export function correctionError(code: string): string {
  if (code === '42501') return 'You can’t correct results in this session.';
  if (code === '23514')
    return 'That rider wasn’t in this session. Choose someone on its list or who rode in it.';
  if (code === '22023')
    return 'Check the correction: give a reason, choose a different rider, or refresh if someone else has just corrected it.';
  return 'The correction couldn’t be saved. Check that migration 019 is applied and try again.';
}
/** session_results RPC: the newest efforts to list, and bests over the whole session. */
export interface SessionResultsData {
  total: number;
  efforts: SessionEffort[];
  bests: {
    rider_id: string;
    rider_name: string;
    distance_metres: number;
    start_mode: string;
    best_ms: number;
    count: number;
  }[];
}
export type Outcome = 'completed' | 'dnf' | 'cancelled' | 'invalid';

/** A linked rider's own live results (rider_results RPC). */
export interface RiderResults {
  efforts: {
    id: string;
    recorded_at: string;
    session_name: string;
    distance_metres: number;
    start_mode: string;
    activity: string;
    outcome: Outcome;
    elapsed_ms: number | null;
  }[];
  groups: {
    distance_metres: number;
    start_mode: string;
    activity: string;
    best_ms: number;
    valid_count: number;
    latest_at: string;
  }[];
  /** One point per session: that session's best, over the rider's whole history. */
  progress?: ProgressPoint[];
}
export interface ProgressPoint {
  distance_metres: number;
  start_mode: string;
  activity: string;
  session_id: string;
  session_name: string;
  day: string;
  best_ms: number;
  count: number;
}

/** Clean tick values for a time axis in milliseconds (step of 10, 20, 50, 100 ms…). */
export function timeTicks(min: number, max: number, target = 4): number[] {
  const span = Math.max(max - min, 10);
  const raw = span / target;
  const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const step = steps.find((s) => s >= raw) ?? 10000;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + step * 0.001; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  completed: 'Completed',
  dnf: 'Did not finish',
  cancelled: 'Cancelled',
  invalid: 'Invalid'
};

/** Seconds for formatTime, which truncates (never rounds) to 3 decimals. */
export const seconds = (ms: number | null) => (ms === null ? null : ms / 1000);

/** Average speed over the effort, in km/h, to one decimal. Not a peak speed. */
export function averageSpeed(distanceMetres: number, ms: number | null): string {
  if (!ms || !(distanceMetres > 0)) return '—';
  return ((Number(distanceMetres) / (ms / 1000)) * 3.6).toFixed(1);
}

export const startLabel = (mode: string) => (mode === 'flying' ? 'Flying' : 'Standing');
export const groupLabel = (g: { distance_metres: number; start_mode: string; activity?: string }) =>
  `${Number(g.distance_metres)} m ${startLabel(g.start_mode).toLowerCase()}${g.activity === 'free_ride' ? ' · open practice' : ''}`;
