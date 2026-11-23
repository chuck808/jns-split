export function rosterFilters(params: URLSearchParams) {
  const query = (params.get('q') ?? '').trim().slice(0, 60);
  const raw = params.get('status') ?? 'active';
  const status = ['active', 'archived', 'all', 'untagged'].includes(raw) ? raw : 'active';
  const number = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(number) && number > 0 ? Math.min(number, 2147483647) : 1;
  return { query, status, page };
}
export interface Roster {
  riders: { id: string; display_name: string; archived_at: string | null }[];
  tags: {
    id: string;
    rider_id: string;
    uid: string;
    assigned_at: string;
    revoked_at: string | null;
  }[];
  total: number;
  page: number;
  pages: number;
}
export interface Overview {
  active: number;
  archived: number;
  tagged: number;
  untagged: number;
  audit: { id: string; action: string; created_at: string; display_name: string | null }[];
}
