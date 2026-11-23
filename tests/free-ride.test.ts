import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  configure,
  scan,
  startLane,
  finishLane,
  clearLane,
  arm,
  finish,
  comparable,
  csv
} from '../src/lib/session.ts';
const tap = (uid: string, lane: number, requestId: string) => ({
  version: 1 as const,
  type: 'scan' as const,
  readerId: 'test',
  uid,
  lane,
  requestId
});
const alex = '04112233445566',
  sam = '04AABBCCDDEEFF';
const free = () => configure(createSession(), 2, 20, 'Flying', 'Free ride');
test('free ride needs no session roster, full lanes, or group arming', () => {
  let s = scan(free(), tap(alex, 1, 'a')).session;
  assert.throws(() => arm(s));
  assert.throws(() => finishLane(s, 1, 3, 'Completed'));
  s = startLane(s, 1);
  assert.equal(s.lanes[1].riderId, null);
  assert.throws(() => finish(s, { 1: 3 }, 'Completed'));
  assert.throws(() => finishLane(s, 1, NaN, 'Completed'));
  s = finishLane(s, 1, 3, 'Completed');
  assert.equal(s.results[0].elapsedUs, 3000000);
  assert.equal(s.results[0].activity, 'Free ride');
  assert.equal(s.lanes[0].riderId, null);
  assert.throws(() => startLane(s, 1));
  assert.equal(scan(s, tap(alex, 1, 'a')).session, s); // replay cannot reassign a consumed check-in
  assert.equal(scan(s, tap(alex, 1, 'new')).session.lanes[0].riderId, 'r1');
});
test('running lane locks identity and settings but other lanes can scan, start and finish', () => {
  let s = startLane(scan(free(), tap(alex, 1, 'a')).session, 1);
  assert.equal(scan(s, tap(alex, 2, 'move')).decision.accepted, false);
  assert.equal(scan(s, tap(sam, 1, 'replace')).decision.accepted, false);
  assert.throws(() => clearLane(s, 1));
  assert.throws(() => configure(s, 1, 30, 'Standing'));
  s = startLane(scan(s, tap(sam, 2, 'b')).session, 2);
  s = finishLane(s, 2, 4, 'Completed');
  assert.equal(s.lanes[0].running, true);
  assert.equal(s.lanes[0].riderId, 'r1');
  s = finishLane(s, 1, 5, 'Completed');
  assert.deepEqual(
    s.results.map((r) => r.riderId),
    ['r2', 'r1']
  );
  assert.equal(new Set(s.results.map((r) => r.id)).size, 2);
  assert.throws(() => finishLane(s, 1, 5, 'Completed'));
});
test('unknown/disabled scans fail and non-completions have no time', () => {
  assert.equal(scan(free(), tap('DEADBEEF', 1, 'a')).decision.accepted, false);
  assert.equal(scan(free(), tap(alex, 4, 'b')).decision.accepted, false);
  for (const outcome of ['DNF', 'Cancelled'] as const) {
    const s = finishLane(startLane(scan(free(), tap(alex, 1, 'a')).session, 1), 1, NaN, outcome);
    assert.equal(s.results[0].elapsedUs, null);
    assert.equal(comparable(s, 'r1').length, 0);
  }
});
test('activity is preserved in exports and comparable history', () => {
  const s = finishLane(startLane(scan(free(), tap(alex, 1, 'a')).session, 1), 1, 4, 'Completed');
  assert.equal(comparable(s, 'r1').length, 1);
  const coached = configure(s, 2, 20, 'Flying', 'Coached');
  assert.equal(comparable(coached, 'r1').length, 0);
  assert.match(csv(coached.results), /Free ride/);
  assert.match(csv(coached.results), /SIMULATED/);
  assert.throws(() => startLane(scan(createSession(), tap(alex, 1, 'a')).session, 1));
});
