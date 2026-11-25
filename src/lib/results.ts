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
