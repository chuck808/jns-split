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
  efforts: SessionEffort[];
  participants: { rider_id: string; display_name: string }[];
  previousBests: { rider_id: string; best_ms: number }[];
}

export interface GridCell extends SessionEffort {
  /** Faster than every earlier Live time we can see for this rider (same distance and start). */
  newBest: boolean;
}
export interface GridRow {
  rider_id: string;
  name: string;
  cells: GridCell[];
  bestToday: number | null;
  previousBest: number | null;
  lastAt: string | null;
}

/**
 * One row per rider: everyone with an effort, plus a coached session's riders still to ride.
 * Demo efforts appear but never set or beat a best.
 */
export function buildGrid(data: TracksideData): GridRow[] {
  const previous = new Map(data.previousBests.map((b) => [b.rider_id, b.best_ms]));
  const rows = new Map<string, GridRow>();
  for (const p of data.participants)
    rows.set(p.rider_id, {
      rider_id: p.rider_id,
      name: p.display_name,
      cells: [],
      bestToday: null,
      previousBest: previous.get(p.rider_id) ?? null,
      lastAt: null
    });
  const ordered = [...data.efforts].sort(
    (a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id)
  );
  for (const e of ordered) {
    let row = rows.get(e.rider_id);
    if (!row) {
      row = {
        rider_id: e.rider_id,
        name: e.rider_name,
        cells: [],
        bestToday: null,
        previousBest: previous.get(e.rider_id) ?? null,
        lastAt: null
      };
      rows.set(e.rider_id, row);
    }
    const live = !e.is_test && e.outcome === 'completed' && e.elapsed_ms !== null;
    const benchmark = [row.previousBest, row.bestToday].filter((v): v is number => v !== null);
    const newBest = live && benchmark.length > 0 && e.elapsed_ms! < Math.min(...benchmark);
    if (live && (row.bestToday === null || e.elapsed_ms! < row.bestToday))
      row.bestToday = e.elapsed_ms;
    row.cells.push({ ...e, newBest });
    row.lastAt = e.recorded_at;
  }
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
