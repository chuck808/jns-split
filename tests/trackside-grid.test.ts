import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, latestByLane, sinceLabel, type TracksideData } from '../src/lib/trackside';

const effort = (
  id: string,
  rider: string,
  lane: number,
  ms: number | null,
  minute: number,
  extra = {}
) => ({
  id,
  rider_id: rider,
  rider_name: rider === 'a' ? 'Alex' : rider === 's' ? 'Sam' : 'Priya',
  lane,
  outcome: ms === null ? ('dnf' as const) : ('completed' as const),
  elapsed_ms: ms,
  is_test: false,
  recorded_at: `2026-11-24T18:${String(minute).padStart(2, '0')}:00Z`,
  distance_metres: 20,
  start_mode: 'flying',
  new_best: false,
  ...extra
});
const data = (over: Partial<TracksideData>): TracksideData => ({
  now: '2026-11-24T18:30:00Z',
  session: {
    id: 's',
    name: 'Today',
    distance_metres: 20,
    start_mode: 'flying',
    lane_count: 2,
    activity: 'coached',
    status: 'planned'
  },
  total: 0,
  efforts: [],
  riders: [],
  participants: [],
  previousBests: [],
  ...over
});

test('whole-session figures win over the capped list, so an early best is never lost', () => {
  // The list holds only Alex's latest two efforts; the database says his best today is 1.300.
  const [a] = buildGrid(
    data({
      total: 600,
      efforts: [
        effort('599', 'a', 1, 1410, 28),
        effort('600', 'a', 1, 1405, 29, { new_best: false })
      ],
      riders: [
        {
          rider_id: 'a',
          rider_name: 'Alex',
          best_today: 1300,
          efforts: 600,
          last_at: '2026-11-24T18:29:00Z'
        }
      ],
      previousBests: [{ rider_id: 'a', best_ms: 1420 }]
    })
  );
  assert.equal(a.bestToday, 1300);
  assert.equal(a.total, 600);
  assert.equal(a.previousBest, 1420);
  assert.deepEqual(
    a.cells.map((c) => [c.id, c.newBest]),
    [
      ['599', false],
      ['600', false]
    ]
  );
});

test('new-best marks come from the database as sent', () => {
  const [a] = buildGrid(
    data({
      efforts: [effort('1', 'a', 1, 1430, 1), effort('2', 'a', 1, 1410, 3, { new_best: true })],
      riders: [
        {
          rider_id: 'a',
          rider_name: 'Alex',
          best_today: 1410,
          efforts: 2,
          last_at: '2026-11-24T18:03:00Z'
        }
      ]
    })
  );
  assert.deepEqual(
    a.cells.map((c) => c.newBest),
    [false, true]
  );
});

test('riders still to ride are listed after those who have ridden, newest first', () => {
  const rows = buildGrid(
    data({
      efforts: [effort('1', 'a', 1, 1430, 1), effort('2', 's', 2, 1500, 4)],
      riders: [
        {
          rider_id: 'a',
          rider_name: 'Alex',
          best_today: 1430,
          efforts: 1,
          last_at: '2026-11-24T18:01:00Z'
        },
        {
          rider_id: 's',
          rider_name: 'Sam',
          best_today: 1500,
          efforts: 1,
          last_at: '2026-11-24T18:04:00Z'
        }
      ],
      participants: [
        { rider_id: 'p', display_name: 'Priya' },
        { rider_id: 'a', display_name: 'Alex' }
      ]
    })
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.cells.length]),
    [
      ['Sam', 1],
      ['Alex', 1],
      ['Priya', 0]
    ]
  );
  const lanes = latestByLane(rows, 2);
  assert.deepEqual(
    lanes.map((l) => l.latest?.id ?? null),
    ['1', '2']
  );
  assert.equal(latestByLane(rows, 3)[2].latest, null);
});

test('rest timer labels', () => {
  const now = Date.parse('2026-11-24T18:30:00Z');
  assert.equal(sinceLabel(null, now), '—');
  assert.equal(sinceLabel('2026-11-24T18:29:55Z', now), '0:05');
  assert.equal(sinceLabel('2026-11-24T18:27:55Z', now), '2:05');
  assert.equal(sinceLabel('2026-11-24T17:27:00Z', now), '1h 03m');
  assert.equal(sinceLabel('2026-11-24T18:31:00Z', now), '0:00', 'clock skew never goes negative');
});
