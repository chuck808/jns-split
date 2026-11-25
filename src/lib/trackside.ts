import type { SessionEffort } from './results';

export interface TracksideData {
  now: string;
  session: {
    id: string;
    name: string;
    distance_metres: number;
    start_mode: string;
    lane_count: number;
    activity: string;
    status: string;
  };
  /** Every effort in the session; `efforts` holds only the newest 500. */
  total: number;
  efforts: (SessionEffort & { new_best: boolean })[];
  /** Per rider over the WHOLE session, worked out in the database. */
  riders: {
    rider_id: string;
    rider_name: string;
    best_today: number | null;
    efforts: number;
    last_at: string;
  }[];
  participants: { rider_id: string; display_name: string }[];
  previousBests: { rider_id: string; best_ms: number }[];
}

export interface GridCell extends SessionEffort {
  /** Faster than the previous best and every earlier Live effort this session (database). */
  newBest: boolean;
}

export interface GridRow {
  rider_id: string;
  name: string;
  cells: GridCell[];
  /** Whole-session figures, so a capped list never hides an early best. */
  bestToday: number | null;
  previousBest: number | null;
  lastAt: string | null;
  total: number;
}

/**
 * One row per rider: everyone with an effort, plus a coached session's riders still to ride.
 * "New best" marks and bests come from the database over the whole session; demo efforts
 * never count.
 */
export function buildGrid(data: TracksideData): GridRow[] {
  const previous = new Map(data.previousBests.map((b) => [b.rider_id, b.best_ms]));
  const rows = new Map<string, GridRow>();
  const row = (id: string, name: string) => {
    let r = rows.get(id);
    if (!r) {
      r = {
        rider_id: id,
        name,
        cells: [],
        bestToday: null,
        previousBest: previous.get(id) ?? null,
        lastAt: null,
        total: 0
      };
      rows.set(id, r);
    }
    return r;
  };
  for (const p of data.participants) row(p.rider_id, p.display_name);
  for (const s of data.riders) {
    const r = row(s.rider_id, s.rider_name);
    r.name = s.rider_name;
    r.bestToday = s.best_today;
    r.lastAt = s.last_at;
    r.total = s.efforts;
  }
  const ordered = [...data.efforts].sort(
    (a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id)
  );
  for (const e of ordered) row(e.rider_id, e.rider_name).cells.push({ ...e, newBest: e.new_best });
  // Riders who've ridden first, most recent at the top; then those still to ride, by name.
  return [...rows.values()].sort((a, b) =>
    a.lastAt && b.lastAt
      ? b.lastAt.localeCompare(a.lastAt)
      : a.lastAt
        ? -1
        : b.lastAt
          ? 1
          : a.name.localeCompare(b.name)
  );
}

/** The newest effort in each lane, for the lane strip. */
export function latestByLane(rows: GridRow[], laneCount: number) {
  const cells = rows.flatMap((r) => r.cells);
  return Array.from({ length: laneCount }, (_, i) => {
    const lane = i + 1;
    const latest = cells
      .filter((c) => c.lane === lane)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id))[0];
    return { lane, latest: latest ?? null };
  });
}

/** "2:05" since a time, for the rest timer. Hours shown as "1h 03m". */
export function sinceLabel(fromIso: string | null, nowMs: number): string {
  if (!fromIso) return '—';
  const total = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / 1000));
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    return `${h}h ${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}m`;
  }
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
