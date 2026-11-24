import test from 'node:test';
import assert from 'node:assert/strict';
import { riderDetailsFromForm, riderSettingsFromForm } from '../src/lib/rider-details';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const today = new Date('2026-11-24T12:00:00Z');
const yearEnd = { age_rule: 'year_end' as const, fields: [] };

test('year of birth is required and must be plausible', () => {
  assert.equal(riderDetailsFromForm(form({}), yearEnd, today).ok, false);
  assert.equal(riderDetailsFromForm(form({ birthYear: '15' }), yearEnd, today).ok, false);
  assert.equal(riderDetailsFromForm(form({ birthYear: '2027' }), yearEnd, today).ok, false);
  assert.deepEqual(riderDetailsFromForm(form({ birthYear: '2015' }), yearEnd, today), {
    ok: true,
    value: { birthYear: 2015, birthDate: null, fields: {} }
  });
});

test('a 31 August rule needs a real past date and takes the year from it', () => {
  const aug = { age_rule: 'season_31_aug' as const, fields: [] };
  assert.equal(riderDetailsFromForm(form({ birthYear: '2014' }), aug, today).ok, false);
  assert.equal(riderDetailsFromForm(form({ birthDate: '2014-02-30' }), aug, today).ok, false);
  assert.equal(riderDetailsFromForm(form({ birthDate: '2027-01-01' }), aug, today).ok, false);
  const ok = riderDetailsFromForm(form({ birthDate: '2014-03-01', birthYear: '1999' }), aug, today);
  assert.deepEqual(ok, {
    ok: true,
    value: { birthYear: 2014, birthDate: '2014-03-01', fields: {} }
  });
});

test('club fields are trimmed, length-limited and required ones enforced', () => {
  const settings = {
    age_rule: 'year_end' as const,
    fields: [
      { id: 'a', label: 'British Cycling licence', required: false },
      { id: 'b', label: 'Kit size', required: true }
    ]
  };
  const missing = riderDetailsFromForm(form({ birthYear: '2015' }), settings, today);
  assert.deepEqual(missing, { ok: false, message: 'Enter Kit size.' });
  const tooLong = riderDetailsFromForm(
    form({ birthYear: '2015', 'field:b': 'x'.repeat(101) }),
    settings,
    today
  );
  assert.equal(tooLong.ok, false);
  const ok = riderDetailsFromForm(
    form({ birthYear: '2015', 'field:a': ' 123 ', 'field:b': 'M' }),
    settings,
    today
  );
  assert.deepEqual(ok, {
    ok: true,
    value: { birthYear: 2015, birthDate: null, fields: { a: '123', b: 'M' } }
  });
});

test('rider settings form validates rule, name and age bands', () => {
  const good = {
    ageRule: 'year_end',
    scoreboardName: 'initials',
    guardianOnlyUnder: '13',
    riderFrom: '18'
  };
  assert.deepEqual(riderSettingsFromForm(form(good)), {
    ok: true,
    value: {
      age_rule: 'year_end',
      scoreboard_name: 'initials',
      guardian_only_under: 13,
      rider_from: 18
    }
  });
  for (const bad of [
    { ...good, ageRule: 'whenever' },
    { ...good, scoreboardName: 'full' },
    { ...good, guardianOnlyUnder: '19', riderFrom: '18' },
    { ...good, riderFrom: '25' },
    { ...good, guardianOnlyUnder: '12.5' }
  ])
    assert.equal(riderSettingsFromForm(form(bad)).ok, false, JSON.stringify(bad));
});
