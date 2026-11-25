export type SessionActivity = 'coached' | 'free_ride';
export const activityLabel = (activity: SessionActivity) =>
  activity === 'free_ride' ? 'Open practice' : 'Coached session';
export function sessionActivity(value: FormDataEntryValue | null): SessionActivity {
  if (value !== 'coached' && value !== 'free_ride')
    throw new Error('Choose coached session or open practice.');
  return value;
}
export interface TrainingSession {
  activity: SessionActivity;
  id: string;
  club_id: string;
  name: string;
  scheduled_at: string | null;
  distance_metres: number;
  start_mode: 'standing' | 'flying';
  lane_count: number;
  status: 'planned' | 'closed' | 'cancelled';
  version: number;
  club_name?: string;
}
export interface SessionList {
  items: TrainingSession[];
  total: number;
  page: number;
  pages: number;
}
export interface SessionDetail {
  session: TrainingSession;
  clubName: string;
  isAdmin: boolean;
  canManage: boolean;
  coaches: { coach_user_id: string; email: string; can_manage: boolean }[];
  audit: { id: string; action: string; created_at: string }[];
}
export function sessionFilters(params: URLSearchParams) {
  const raw = params.get('status') ?? 'planned';
  const status = ['all', 'planned', 'closed', 'cancelled'].includes(raw) ? raw : 'planned';
  const n = Number(params.get('page') ?? 1);
  return { status, page: Number.isSafeInteger(n) && n > 0 ? Math.min(n, 2147483647) : 1 };
}
export function sessionInput(form: FormData) {
  const name = String(form.get('name') ?? '').trim();
  const distance = Number(form.get('distance'));
  const mode = String(form.get('mode') ?? '');
  const lanes = Number(form.get('lanes'));
  const scheduled = String(form.get('scheduled') ?? '');
  if (
    !name ||
    name.length > 100 ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    distance > 10000 ||
    !['standing', 'flying'].includes(mode) ||
    !Number.isInteger(lanes) ||
    lanes < 1 ||
    lanes > 4
  )
    throw new Error(
      'Enter a name, a distance above zero (up to 10,000 m), a start type and 1–4 lanes.'
    );
  let date: string | null = null;
  if (scheduled) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduled))
      throw new Error('Enter a valid UTC date and time.');
    const parsed = new Date(scheduled + ':00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== scheduled)
      throw new Error('Enter a valid UTC date and time.');
    date = parsed.toISOString();
  }
  return { p_name: name, p_scheduled_at: date, p_distance: distance, p_mode: mode, p_lanes: lanes };
}
export function sessionError(code: string) {
  if (code === '42501') return 'You no longer have permission for this session.';
  if (code === '40001')
    return 'Someone changed this session. Refresh the page before saving again.';
  if (code === '22023')
    return 'This session is closed, the coach is no longer approved, or a field is invalid. Refresh and check the values.';
  if (code === '23514')
    return 'Results have been recorded for this session, so its distance, start type and type of session can’t change. Plan a new session for a different setup.';
  return 'Unable to save. Check the session migration and try again.';
}
export const sessionDate = (v: string | null) =>
  v ? new Date(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'Not scheduled';
