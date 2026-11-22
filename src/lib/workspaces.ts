export interface Workspace {
  key: string;
  label: string;
  description: string;
  href: string;
}
export function rememberedWorkspace(raw: string | undefined, userId: string, items: Workspace[]) {
  if (!raw?.startsWith(userId + '|')) return undefined;
  const key = raw.slice(userId.length + 1);
  return items.find((item) => item.key === key);
}
