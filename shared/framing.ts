/** Protocol v3: a four-byte big-endian byte length followed by UTF-8 JSON. */
export const MAX_CONTROL_BYTES = 16_384;
export const MAX_SNAPSHOT_BYTES = 65_536;
const encoder = new TextEncoder();
export function encodeFrame(text: string, maximum = MAX_CONTROL_BYTES): Uint8Array {
  const payload = encoder.encode(text);
  if (!payload.length || payload.length > maximum) throw new Error('Frame exceeds the protocol limit.');
  const frame = new Uint8Array(payload.length + 4);
  new DataView(frame.buffer).setUint32(0, payload.length, false); frame.set(payload, 4); return frame;
}
export class FrameDecoder {
  private header = new Uint8Array(4);
  private headerUsed = 0;
  private body: Uint8Array | undefined;
  private bodyUsed = 0;
  constructor(private maximum = MAX_CONTROL_BYTES) {}
  push(chunk: Uint8Array): string[] {
    const messages: string[] = []; let offset = 0;
    while (offset < chunk.length) {
      if (!this.body) {
        const n = Math.min(4 - this.headerUsed, chunk.length - offset);
        this.header.set(chunk.subarray(offset, offset + n), this.headerUsed); this.headerUsed += n; offset += n;
        if (this.headerUsed < 4) continue;
        const size = new DataView(this.header.buffer).getUint32(0, false);
        if (size === 0 || size > this.maximum) throw new Error('Invalid frame length.');
        this.body = new Uint8Array(size); this.bodyUsed = 0;
      }
      const n = Math.min(this.body.length - this.bodyUsed, chunk.length - offset);
      this.body.set(chunk.subarray(offset, offset + n), this.bodyUsed); this.bodyUsed += n; offset += n;
      if (this.bodyUsed === this.body.length) {
        messages.push(new TextDecoder('utf-8', { fatal: true }).decode(this.body));
        this.body = undefined; this.headerUsed = 0; this.bodyUsed = 0;
      }
    }
    return messages;
  }
  finish(): void { if (this.headerUsed || this.body) throw new Error('Truncated frame.'); }
}
