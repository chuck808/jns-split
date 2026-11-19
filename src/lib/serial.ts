import { parseScan, type Scan } from './session';
interface Port {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
interface Serial {
  requestPort(): Promise<Port>;
}
/** Read-only bench connection: no acknowledgement is ever sent to real timing hardware. */
export async function connectReader(
  onScan: (scan: Scan) => void,
  onStatus: (message: string) => void
): Promise<() => Promise<void>> {
  const serial = (navigator as Navigator & { serial?: Serial }).serial;
  if (!serial)
    throw new Error(
      'USB reader connection needs desktop Chrome or Edge on localhost or HTTPS. You can also paste a scan below.'
    );
  const port = await serial.requestPort();
  await port.open({ baudRate: 115200 });
  const reader = port.readable?.getReader();
  if (!reader) {
    await port.close();
    throw new Error('Serial port is not readable.');
  }
  let stopped = false;
  const task = (async () => {
    let buffer = '';
    const decoder = new TextDecoder();
    try {
      onStatus('USB reader connected. Read-only bench mode.');
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 4096) {
          buffer = '';
          onStatus('Discarded oversized serial input.');
          continue;
        }
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          if (!line.startsWith('{')) continue;
          try {
            onScan(parseScan(line));
          } catch {
            onStatus('Ignored an invalid or non-scan reader message.');
          }
        }
      }
    } catch {
      onStatus('Reader disconnected. Reconnect when ready.');
    } finally {
      reader.releaseLock();
      try {
        await port.close();
      } catch {}
      onStatus('USB reader disconnected.');
    }
  })();
  return async () => {
    stopped = true;
    await reader.cancel().catch(() => {});
    await task;
  };
}
