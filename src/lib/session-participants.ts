export interface ParticipantPage {
  items: { id: string; display_name: string; archived: boolean }[];
  total: number;
  page: number;
  pages: number;
}
export interface CandidatePage {
  items: { id: string; display_name: string }[];
  total: number;
  page: number;
  pages: number;
}
export function participantFilters(params: URLSearchParams) {
  const page = (key: string) => {
    const n = Number(params.get(key) ?? 1);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 2147483647) : 1;
  };
  return {
    query: (params.get('riderQuery') ?? '').trim().slice(0, 60),
    participantsPage: page('participantsPage'),
    candidatesPage: page('candidatesPage')
  };
}
export function participantError(code: string) {
  if (code === '42501')
    return 'Only an administrator of this club can change its session participants.';
  if (code === '40001')
    return 'This session changed in another tab. Refresh before changing participants.';
  if (code === '22023')
    return 'The session is closed or the rider is unavailable. Only active riders from this club can be added.';
  return 'Unable to save participants. Check the participants migration and try again.';
}
