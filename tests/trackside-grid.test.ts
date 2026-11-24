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
  ...extra
});
const data = (
  efforts: any[],
  previousBests: any[] = [],
  participants: any[] = []
): TracksideData => ({
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
  efforts,
  participants,
  previousBests
});

test('new bests beat the previous best and earlier efforts today; demo and DNF never count', () => {
  const rows = buildGrid(
    data(
      [
        effort('1', 'a', 1, 1430, 1), // slower than previous 1420
        effort('2', 'a', 1, 1410, 3), // beats 1420: new best
        effort('3', 'a', 1, 1415, 5), // slower than 1410 today
        effort('4', 'a', 1, 1000, 7, { is_test: true }), // demo: never a best
        effort('5', 'a', 1, null, 9), // DNF
        effort('6', 'a', 1, 1405, 11) // beats 1410: new best
      ],
      [{ rider_id: 'a', best_ms: 1420 }]
    )
  );
  const a = rows[0];
  assert.deepEqual(
    a.cells.map((c) => c.newBest),
    [false, true, false, false, false, true]
  );
  assert.equal(a.bestToday, 1405);
  assert.equal(a.previousBest, 1420);
});

test('without a previous best, the first time sets the bar and only later improvements are marked', () => {
  const [s] = buildGrid(data([effort('1', 's', 2, 1500, 1), effort('2', 's', 2, 1490, 2)]));
  assert.deepEqual(
    s.cells.map((c) => c.newBest),
    [false, true]
  );
  assert.equal(s.previousBest, null);
});

test('riders still to ride are listed after those who have ridden, newest first', () => {
  const rows = buildGrid(
    data(
      [effort('1', 'a', 1, 1430, 1), effort('2', 's', 2, 1500, 4)],
      [],
      [
        { rider_id: 'p', display_name: 'Priya' },
        { rider_id: 'a', display_name: 'Alex' }
      ]
    )
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
