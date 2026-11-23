export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];
export function theme(value: unknown): Theme {
  return themes.includes(value as Theme) ? (value as Theme) : 'system';
}
export function returnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return '/';
  try {
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' ? url.pathname + url.search : '/';
  } catch {
    return '/';
  }
}
