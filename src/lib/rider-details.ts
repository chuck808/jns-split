export type AgeRule = 'year_end' | 'season_31_aug' | 'none';
export type ScoreboardName = 'first_initial' | 'initials' | 'lane';

export interface RiderField {
  id: string;
  label: string;
  required: boolean;
}
export interface RiderSettings {
  age_rule: AgeRule;
  guardian_only_under: number;
  rider_from: number;
  scoreboard_name: ScoreboardName;
  fields: RiderField[];
}
export interface RiderDetailsInput {
  birthYear: number | null;
  birthDate: string | null;
  fields: Record<string, string>;
}

export const AGE_RULES: { value: AgeRule; label: string; description: string }[] = [
  {
    value: 'year_end',
    label: 'Age on 31 December',
    description: 'As used in BMX. Year of birth is enough.'
  },
  {
    value: 'season_31_aug',
    label: 'Age on 31 August',
    description: 'As used in UK athletics. Needs a full date of birth.'
  },
  { value: 'none', label: 'No age groups', description: 'Only year of birth is recorded.' }
];
export const SCOREBOARD_NAMES: { value: ScoreboardName; label: string; example: string }[] = [
  { value: 'first_initial', label: 'First name and initial', example: 'Alex M.' },
  { value: 'initials', label: 'Initials only', example: 'A.M.' },
  { value: 'lane', label: 'Lane number only', example: 'Lane 2' }
];

/** True when the club's age rule needs a full date of birth. */
export const needsBirthDate = (settings: Pick<RiderSettings, 'age_rule'>) =>
  settings.age_rule === 'season_31_aug';

/**
 * Read and check rider details from a submitted form against the club's
 * settings. Mirrors the database checks so people get a clear message before
 * anything is sent; the database still enforces every rule.
 */
export function riderDetailsFromForm(
  form: FormData,
  settings: Pick<RiderSettings, 'age_rule' | 'fields'>,
  today = new Date()
): { ok: true; value: RiderDetailsInput } | { ok: false; message: string } {
  const thisYear = today.getUTCFullYear();
  let birthDate: string | null = null;
  let birthYear: number | null = null;
  const rawDate = String(form.get('birthDate') ?? '').trim();
  const rawYear = String(form.get('birthYear') ?? '').trim();

  if (needsBirthDate(settings) || rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate))
      return { ok: false, message: 'Enter the rider’s date of birth.' };
    const parsed = new Date(rawDate + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== rawDate)
      return { ok: false, message: 'Enter a real date of birth.' };
    if (parsed > today || parsed.getUTCFullYear() < 1900)
      return { ok: false, message: 'Enter a date of birth in the past.' };
    birthDate = rawDate;
    birthYear = parsed.getUTCFullYear();
  } else {
    if (!/^\d{4}$/.test(rawYear)) return { ok: false, message: 'Enter the rider’s year of birth.' };
    birthYear = Number(rawYear);
    if (birthYear < 1900 || birthYear > thisYear)
      return { ok: false, message: `Enter a year of birth between 1900 and ${thisYear}.` };
  }

  const fields: Record<string, string> = {};
  for (const field of settings.fields) {
    const v = String(form.get(`field:${field.id}`) ?? '').trim();
    if (v.length > 100)
      return { ok: false, message: `${field.label} must be 100 characters or fewer.` };
    if (field.required && !v) return { ok: false, message: `Enter ${field.label}.` };
    fields[field.id] = v;
  }
  return { ok: true, value: { birthYear, birthDate, fields } };
}

/** Read the club rider-settings form. */
export function riderSettingsFromForm(
  form: FormData
): { ok: true; value: Omit<RiderSettings, 'fields'> } | { ok: false; message: string } {
  const age = String(form.get('ageRule') ?? '');
  const name = String(form.get('scoreboardName') ?? '');
  const under = Number(form.get('guardianOnlyUnder'));
  const from = Number(form.get('riderFrom'));
  if (!AGE_RULES.some((r) => r.value === age))
    return { ok: false, message: 'Choose how age groups are worked out.' };
  if (!SCOREBOARD_NAMES.some((n) => n.value === name))
    return { ok: false, message: 'Choose how names appear on the scoreboard.' };
  if (!Number.isInteger(under) || !Number.isInteger(from) || under < 0 || from > 21 || under > from)
    return {
      ok: false,
      message:
        'Invitation ages must be whole numbers from 0 to 21, with the guardian-only age first.'
    };
  return {
    ok: true,
    value: {
      age_rule: age as AgeRule,
      scoreboard_name: name as ScoreboardName,
      guardian_only_under: under,
      rider_from: from
    }
  };
}
