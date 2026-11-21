export interface ClubCoaches {
  coaches: { user_id: string; email: string; created_at: string }[];
  invitations: {
    id: string;
    email: string;
    status: string;
    created_at: string;
    expires_at: string;
  }[];
  total: number;
  page: number;
  pages: number;
  inviteTotal: number;
  invitePage: number;
  invitePages: number;
}
export interface CoachWorkspace {
  clubs: { id: string; name: string; created_at: string }[];
  invitations: { id: string; club_name: string; expires_at: string }[];
  emailConfirmed: boolean;
}
export function coachError(code: string): string {
  if (code === '23505') return 'This person already has a club membership or a pending invitation.';
  if (code === '42501')
    return 'You do not have access to this invitation or club. Check the signed-in account.';
  if (code === '22023')
    return 'The invitation or membership is no longer available, or a field is invalid. Refresh and try again.';
  return 'The change could not be saved. Check the coach migration and try again.';
}
export function emailAddress(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
