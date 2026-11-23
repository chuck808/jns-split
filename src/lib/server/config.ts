export function backendConfig(url: string, key: string): { url: string; key: string } | null {
  if (!url || !key) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.username ||
    parsed.password ||
    (parsed.protocol !== 'https:' &&
      !(
        parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      ))
  )
    return null;
  if (key.startsWith('sb_publishable_')) return { url, key };
  // Legacy anon keys are supported. Reject elevated keys even when configured by mistake.
  try {
    const parts = key.split('.');
    if (
      parts.length !== 3 ||
      JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role !== 'anon'
    )
      return null;
    return { url, key };
  } catch {
    return null;
  }
}
