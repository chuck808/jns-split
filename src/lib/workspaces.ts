export interface Workspace {
  key: string;
  label: string;
  description: string;
  href: string;
}
/** Signed-in app shell data. The workspace list drives the account menu only. */
export interface ShellData {
  email: string;
  workspaces: Workspace[];
  /** Key of the workspace the current area belongs to, if any. */
  currentKey: string | null;
}
export function rememberedWorkspace(raw: string | undefined, userId: string, items: Workspace[]) {
  if (!raw?.startsWith(userId + '|')) return undefined;
  const key = raw.slice(userId.length + 1);
  return items.find((item) => item.key === key);
}
