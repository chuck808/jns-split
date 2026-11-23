export interface ClubApplication {
  id: string;
  club_name: string;
  town: string;
  sport: string;
  status: string;
  created_at: string;
  applicant_name: string;
  contact_email: string;
  decided_at: string | null;
  decision_reason: string | null;
  club_id: string | null;
}
export interface ApplicationList {
  items: ClubApplication[];
  total: number;
  page: number;
  pages: number;
}
export interface ApplicationDetail {
  application: ClubApplication;
  isApplicant: boolean;
  canReview: boolean;
  events: { action: string; created_at: string }[];
  matchingClubs: { id: string; name: string }[];
}
export interface PlatformOverview {
  pending: number;
  clubs: number;
  decisions: { application_id: string; club_name: string; action: string; created_at: string }[];
}
export function applicationFilters(params: URLSearchParams, defaultStatus = 'all') {
  const raw = params.get('status') ?? defaultStatus,
    n = Number(params.get('page') ?? 1);
  return {
    status: ['all', 'submitted', 'approved', 'declined', 'withdrawn'].includes(raw)
      ? raw
      : defaultStatus,
    page: Number.isSafeInteger(n) && n > 0 ? Math.min(n, 2147483647) : 1
  };
}
export function admissionError(code: string) {
  if (code === '42501')
    return 'A verified account and the appropriate permission are required. Refresh or sign in again.';
  if (code === '23505') return 'You already have an application awaiting review. Open it below.';
  if (code === 'P0001')
    return 'You have reached the limit of three new applications in 24 hours. Try again later.';
  if (code === '22023')
    return 'Check the fields and refresh. This application may already have been decided or withdrawn.';
  return 'Unable to save. Try again, or contact the pilot administrator.';
}
