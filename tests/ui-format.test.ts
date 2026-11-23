import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGap,
  formatTime,
  initials,
  isLane,
  laneColour,
  tagSuffix
} from '../src/lib/ui/format';

test('formatTime shows three decimals and truncates rather than rounding up', () => {
  assert.equal(formatTime(1.398), '1.398');
  assert.equal(formatTime(1.3989), '1.398');
  assert.equal(formatTime(1.4), '1.400');
  assert.equal(formatTime(0.1 + 0.2), '0.300');
  assert.equal(formatTime(12.34567, 2), '12.34');
  assert.equal(formatTime(3, 0), '3');
});

test('formatTime shows an em dash when there is no valid time', () => {
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -0.5])
    assert.equal(formatTime(value), '—');
});

test('formatGap is signed and blank without both times', () => {
  assert.equal(formatGap(1.398, 1.431), '−0.033');
  assert.equal(formatGap(1.462, 1.412), '+0.050');
  assert.equal(formatGap(1.4, 1.4), '±0.000');
  assert.equal(formatGap(null, 1.4), '');
  assert.equal(formatGap(1.4, undefined), '');
});

test('lanes are 1 to 4 and map to fixed colour tokens', () => {
  assert.ok(isLane(1) && isLane(4));
  assert.ok(!isLane(0) && !isLane(5) && !isLane('2'));
  assert.equal(laneColour(3), 'var(--lane-3)');
});

test('initials are never empty', () => {
  assert.equal(initials('Riverside BMX Club'), 'RC');
  assert.equal(initials('alex'), 'AL');
  assert.equal(initials('  '), '?');
  assert.equal(initials(null), '?');
  assert.equal(initials('Zoë Ó Briain'), 'ZB');
});

test('tagSuffix shows the last four hex characters', () => {
  assert.equal(tagSuffix('04:a2:1b:7c:9d:3f:a3'), '…3FA3');
  assert.equal(tagSuffix('04a21b7c'), '…1B7C');
  assert.equal(tagSuffix('ab'), 'AB');
  assert.equal(tagSuffix(null), '—');
});
