import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  scan,
  arm,
  finish,
  configure,
  enrol,
  parseScan,
  normalizeUid,
  speed,
  csv
} from '../src/lib/session.ts';
const event = (uid = '04112233445566', lane = 1, requestId = 'first') => ({
  version: 1 as const,
  type: 'scan' as const,
  readerId: 'bench',
  uid,
  lane,
  requestId
});
test('UID parsing retains zero bytes and rejects malformed or shortened identities', () => {
  assert.equal(normalizeUid('04:00:01:02:03:04:05'), '04000102030405');
  assert.throws(() => normalizeUid('123'));
  assert.throws(() => parseScan(JSON.stringify({ ...event(), lane: 1.5 })));
});
test('unknown, occupied, and disabled lanes reject without replacing rider', () => {
  let s = createSession();
  assert.equal(scan(s, event('FFFFFFFF')).decision.accepted, false);
  s = scan(s, event()).session;
  assert.equal(scan(s, event('04AABBCCDDEEFF', 1, 'second')).decision.accepted, false);
  assert.equal(scan(s, event('04AABBCCDDEEFF', 4, 'third')).decision.accepted, false);
  assert.equal(s.lanes[0].riderId, 'r1');
});
test('same request is idempotent; altered retry rejected; unarmed move clears old lane', () => {
  let s = scan(createSession(), event()).session;
  assert.equal(scan(s, event()).session, s);
  assert.equal(scan(s, event('04AABBCCDDEEFF')).decision.accepted, false);
  s = scan(s, event('04112233445566', 2, 'move')).session;
  assert.equal(s.lanes[0].riderId, null);
  assert.equal(s.lanes[1].riderId, 'r1');
});
test('arming requires all lanes and freezes assignment, mode and distance', () => {
  let s = scan(createSession(), event()).session;
  assert.throws(() => arm(s));
  s = scan(s, event('04AABBCCDDEEFF', 2, 'second')).session;
  s = arm(s);
  assert.equal(scan(s, event('04102030405060', 1, 'late')).decision.accepted, false);
  assert.throws(() => configure(s, 1, 30, 'Standing'));
  assert.throws(() => enrol(s, 'New', 'DEADBEEF'));
});
test('completion validates times, saves immutable configuration, consumes registrations', () => {
  let s = configure(createSession(), 1, 20, 'Flying');
  s = arm(scan(s, event()).session);
  assert.throws(() => finish(s, { 1: NaN }, 'Completed'));
  s = finish(s, { 1: 4 }, 'Completed');
  assert.equal(speed(s.results[0]), 18);
  assert.equal(s.results[0].elapsedUs, 4000000);
  assert.equal(s.lanes[0].riderId, null);
  const next = configure(s, 1, 30, 'Standing');
  assert.equal(next.results[0].distance, 20);
  assert.equal(scan(next, event()).session, next);
  assert.equal(next.lanes[0].riderId, null);
});
test('cancelled and DNF efforts have no fabricated time or speed', () => {
  for (const outcome of ['Cancelled', 'DNF'] as const) {
    let s = configure(createSession(), 1, 20, 'Flying');
    s = finish(arm(scan(s, event()).session), {}, outcome);
    assert.equal(s.results[0].elapsedUs, null);
    assert.equal(speed(s.results[0]), null);
    assert.match(csv(s.results), /SIMULATED/);
  }
});
