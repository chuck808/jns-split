import { createHash, randomBytes } from 'node:crypto';
import { uuid } from '#lib/coaches';
import { normalizeUid } from '#lib/session';
export function newBenchToken() {
  const token = randomBytes(32).toString('hex');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}
export function benchCredential(header: string | null) {
  const match = /^Bearer ([0-9a-f-]{36})\.([0-9a-f]{64})$/i.exec(header ?? '');
  if (!match || !uuid(match[1]) || match[2] !== match[2].toLowerCase())
    throw new Error('Invalid credential');
  return { p_id: match[1], p_token: match[2] };
}
export function benchInput(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invalid event');
  const v = value as Record<string, unknown>;
  if (
    v.simulated !== true ||
    typeof v.requestId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(v.requestId) ||
    typeof v.action !== 'string' ||
    !['scan', 'start', 'clear'].includes(v.action) ||
    !Number.isInteger(v.lane) ||
    Number(v.lane) < 1 ||
    Number(v.lane) > 4
  )
    throw new Error('Invalid test event');
  if (v.action !== 'scan' && v.uid !== undefined && v.uid !== '') throw new Error('Unexpected UID');
  if (v.action === 'scan' && typeof v.uid !== 'string') throw new Error('UID required');
  return {
    p_request_id: v.requestId,
    p_action: v.action,
    p_lane: v.lane as number,
    p_uid: v.action === 'scan' ? normalizeUid(v.uid as string) : ''
  };
}
export async function limitedJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    throw new Error('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Body required');
  let text = '',
    size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
export function benchResponse(
  data: { code: string; name?: string; replay?: boolean },
  lane: number
) {
  // Strip line/control characters from display names before the simple device text protocol.
  const name = (data.name ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 60);
  return `SIMULATED${data.replay ? ' REPLAY' : ''}\n${data.code}\nLane ${lane}${name ? '\n' + name : ''}\nNo real timing or check-in.`;
}
