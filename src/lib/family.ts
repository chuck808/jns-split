import type { ScoreboardName } from './rider-details';

export type LinkKind = 'guardian' | 'rider';

/** Admin view of one rider's family access (rider_access RPC). */
export interface RiderAccess {
  rider: {
    id: string;
    display_name: string;
    birth_year: number | null;
    birth_date: string | null;
    archived_at: string | null;
    scoreboard_name: ScoreboardName | null;
  };
  minAge: number | null;
  guardianOnlyUnder: number;
  riderFrom: number;
  allowedKinds: LinkKind[];
  links: { id: string; kind: LinkKind; email: string; created_at: string }[];
  invitations: {
    id: string;
    email: string;
    kind: LinkKind;
    status: string;
    created_at: string;
    expires_at: string;
  }[];
  corrections: { id: string; message: string; email: string; created_at: string }[];
}

export interface CorrectionSummary {
  id: string;
  rider_id: string;
  display_name: string;
  created_at: string;
}

/** What a signed-in rider or guardian sees (my_rider_workspace RPC). */
export interface RiderWorkspace {
  emailConfirmed: boolean;
  invitations: {
    id: string;
    kind: LinkKind;
    expires_at: string;
    club_name: string;
    rider_name: string;
  }[];
  riders: LinkedRider[];
}
export interface LinkedRider {
  link_id: string;
  kind: LinkKind;
  rider_id: string;
  display_name: string;
  club_name: string;
  birth_year: number | null;
  birth_date: string | null;
  scoreboard_name: ScoreboardName;
  scoreboard_chosen: boolean;
  has_tag: boolean;
  fields: { label: string; value: string }[];
  open_corrections: number;
}

export const KIND_LABELS: Record<LinkKind, string> = {
  guardian: 'Parent or guardian',
  rider: 'The rider'
};

/** Plain-English summary of who the club's age bands allow to be invited. */
export function bandSummary(access: Pick<RiderAccess, 'allowedKinds' | 'minAge'>): string {
  const kinds = access.allowedKinds;
  if (access.minAge === null)
    return 'Add a year of birth first, so the club’s age bands can apply.';
  if (kinds.length === 2)
    return 'Your club’s age bands let you choose: the rider or a parent or guardian.';
  if (kinds[0] === 'guardian') return 'Your club’s age bands say a parent or guardian only.';
  return 'Your club’s age bands say the rider themself.';
}

export function familyError(code: string): string {
  if (code === '23505')
    return 'That person is already linked or already has an invitation waiting, or this rider already has their own account.';
  if (code === '23514')
    return 'Your club’s age bands don’t allow that, or there are already three open requests. Nothing was saved.';
  if (code === '42501')
    return 'You don’t have access to this rider or invitation. Check the account you’re signed in with.';
  if (code === '22023')
    return 'This is no longer available, or something needs checking: the email, the permissions tick, or the message. Refresh and try again.';
  return 'The change could not be saved. Check the family access migration (012) has been applied and try again.';
}

export const isKind = (value: unknown): value is LinkKind =>
  value === 'guardian' || value === 'rider';

/** How a name would look on the scoreboard, for showing the choice to a family. */
export function scoreboardPreview(name: string, choice: ScoreboardName): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (choice === 'lane' || !parts.length) return 'Lane 2';
  if (choice === 'initials') return parts.map((p) => p[0].toUpperCase() + '.').join('');
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
