/** A JSON download with a safe, readable file name. */
export function jsonDownload(data: unknown, name: string, kind: string): Response {
  const slug =
    name
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'rider';
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="jns-split-${kind}-${slug}-${day}.json"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
