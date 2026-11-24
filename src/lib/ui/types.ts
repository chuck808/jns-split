export interface NavItem {
  href: string;
  label: string;
  /** Also mark as current on child paths, e.g. /club/x/riders/123 for Riders. */
  prefix?: boolean;
}

export interface Choice {
  value: string;
  label: string;
  description?: string;
}
