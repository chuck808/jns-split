/** Lane numbers the hardware supports. Lane colours are fixed everywhere. */
export const LANES = [1, 2, 3, 4] as const;
export type Lane = (typeof LANES)[number];

export function isLane(value: unknown): value is Lane {
  return LANES.includes(value as Lane);
}

/** CSS custom property for a lane's colour, e.g. `var(--lane-2)`. */
export function laneColour(lane: Lane): string {
  return `var(--lane-${lane})`;
}

/**
 * Elapsed time in seconds as shown everywhere in SPLIT: fixed decimals,
 * never rounded up past what was measured, and an em dash when there is
 * no valid time. Negative and non-finite values are treated as no time.
 */
export function formatTime(seconds: number | null | undefined, decimals = 3): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return '—';
  const places = Math.min(Math.max(Math.trunc(decimals), 0), 3);
  const factor = 10 ** places;
  const truncated = Math.floor(seconds * factor + 1e-9) / factor;
  return truncated.toFixed(places);
}

/** Signed gap to a reference time, e.g. "−0.033" or "+0.012". */
export function formatGap(
  seconds: number | null | undefined,
  reference: number | null | undefined
) {
  if (
    seconds === null ||
    seconds === undefined ||
    reference === null ||
    reference === undefined ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(reference)
  )
    return '';
  const gap = Math.round((seconds - reference) * 1000) / 1000;
  if (gap === 0) return '±0.000';
  return (gap < 0 ? '−' : '+') + Math.abs(gap).toFixed(3);
}

/** Two-letter initials for avatars; never empty. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '');
  return (first + second).toUpperCase();
}
