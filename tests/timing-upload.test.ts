import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceText, effortInput, effortStatus } from '../src/lib/server/timing';

const good = {
  version: 1,
  resultId: 'boot-42',
  sessionId: '7d0e8a8c-0000-4000-8000-000000000000',
  lane: 1,
  uid: '04:a1:b2:c3',
  outcome: 'completed',
  elapsedMs: 1405
};

test('upload v1 accepts a well-formed effort and normalises the tag', () => {
  assert.deepEqual(effortInput(good), {
    p_result_id: 'boot-42',
    p_session_id: good.sessionId,
    p_lane: 1,
    p_uid: '04A1B2C3',
    p_outcome: 'completed',
    p_elapsed_ms: 1405
  });
  const dnf = effortInput({ ...good, outcome: 'dnf', elapsedMs: undefined });
  assert.equal(dnf.p_elapsed_ms, null);
  assert.equal(effortInput({ ...good, outcome: 'invalid', elapsedMs: null }).p_outcome, 'invalid');
});

test('upload v1 rejects anything else', () => {
  for (const bad of [
    null,
    [],
    'text',
    { ...good, version: 2 },
    { ...good, resultId: '' },
    { ...good, resultId: 'has space' },
    { ...good, resultId: 'x'.repeat(81) },
    { ...good, sessionId: 'not-a-uuid' },
    { ...good, lane: 0 },
    { ...good, lane: 5 },
    { ...good, lane: 1.5 },
    { ...good, uid: '123' },
    { ...good, uid: 42 },
    { ...good, outcome: 'won' },
    { ...good, elapsedMs: undefined },
    { ...good, elapsedMs: 0 },
    { ...good, elapsedMs: 600001 },
    { ...good, elapsedMs: 1405.5 },
    { ...good, elapsedMs: '1405' },
    { ...good, outcome: 'dnf' }
  ])
    assert.throws(() => effortInput(bad), Error, JSON.stringify(bad));
});

test('status codes tell a controller whether to retry', () => {
  assert.equal(effortStatus('SAVED'), 200);
  assert.equal(effortStatus('RESULT_ID_CONFLICT'), 409);
  for (const code of ['TAG_UNAVAILABLE', 'NOT_IN_SESSION', 'LANE_DISABLED', 'SESSION_CLOSED'])
    assert.equal(effortStatus(code), 422);
  assert.equal(deviceText('Alex\nTest\x07'), 'Alex Test ');
});
