import { encodeFrame, FrameDecoder, MAX_CONTROL_BYTES, MAX_SNAPSHOT_BYTES } from '../shared/framing.js';
export interface GameTransport {
  readonly bufferedAmount: number;
  connect(url: string, message: (data: string) => void, closed: () => void): Promise<void>;
  sendReliable(data: string): boolean;
  sendLatest(data: string): boolean;
  close(): void;
}
interface BiStream { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
interface BrowserTransport {
  ready: Promise<void>; closed: Promise<unknown>;
  createBidirectionalStream(): Promise<BiStream>;
  incomingUnidirectionalStreams: ReadableStream<ReadableStream<Uint8Array>>;
  close(): void;
}
export interface TransportConfig { url: string; certificateHashes?: number[][]; protocolVersion: number; loopbackUrl?: string }
export type TransportFactory = (url: string, options: { serverCertificateHashes?: { algorithm: string; value: Uint8Array }[] }) => BrowserTransport;
const browserFactory: TransportFactory = (url, options) => {
  const Constructor = (globalThis as unknown as { WebTransport?: new (url: string, options: unknown) => BrowserTransport }).WebTransport;
  if (!Constructor) throw new Error('This browser does not support WebTransport. Use a WebTransport-capable browser on HTTPS or localhost.');
  return new Constructor(url, options);
};
/** Inputs remain ordered for deterministic prediction. Independent, short-lived
 * snapshot streams avoid a lost old snapshot blocking newer observations. No WS fallback. */
export class WebTransportTransport implements GameTransport {
  private transport?: BrowserTransport;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  private accepting?: ReadableStreamDefaultReader<ReadableStream<Uint8Array>>;
  private queued = 0; private generation = 0; private closedCallback?: () => void;
  private tail: Promise<void> = Promise.resolve(); private newest = -Infinity;
  constructor(private config?: TransportConfig, private factory: TransportFactory = browserFactory) {}
  get bufferedAmount(): number { return this.queued; }
  async connect(url: string, message: (data: string) => void, closed: () => void): Promise<void> {
    this.close(); const generation = this.generation; this.closedCallback = closed;
    const config = this.config ?? await this.discover(url);
    if (generation !== this.generation) throw new Error('Connection cancelled.');
    if (config.protocolVersion !== 3) throw new Error('Client/server versions differ. Rebuild and restart Echo.');
    // A host playing locally while sharing must not depend on router NAT hairpinning.
    const localHost = typeof location !== 'undefined' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    let endpoint = new URL(config.url);
    if (localHost && config.loopbackUrl) {
      const local = new URL(config.loopbackUrl);
      if (local.protocol !== 'https:' || !['localhost','127.0.0.1','[::1]'].includes(local.hostname)) throw new Error('Invalid local WebTransport endpoint.');
      endpoint = local;
    }
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Invalid WebTransport endpoint.');
    const hashes = config.certificateHashes;
    if (hashes && (!Array.isArray(hashes) || hashes.length > 2 || hashes.some(hash => !Array.isArray(hash) || hash.length !== 32 || hash.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)))) throw new Error('Invalid certificate fingerprint.');
    const transport = this.factory(endpoint.href, hashes?.length ? { serverCertificateHashes: hashes.map(hash => ({ algorithm: 'sha-256', value: new Uint8Array(hash) })) } : {});
    this.transport = transport;
    void transport.closed.then(() => this.fail(generation), () => this.fail(generation));
    try {
      await transport.ready;
      if (generation !== this.generation) { transport.close(); throw new Error('Connection cancelled.'); }
      const stream = await transport.createBidirectionalStream();
      if (generation !== this.generation) { transport.close(); throw new Error('Connection cancelled.'); }
      this.writer = stream.writable.getWriter();
      void this.writer.closed.catch(() => this.fail(generation));
      void this.read(stream.readable, false, message, generation).then(() => this.fail(generation), () => this.fail(generation));
      void this.acceptSnapshots(transport, message, generation).catch(() => this.fail(generation));
    } catch (error) { if (generation === this.generation) this.close(); throw error; }
  }
  private async discover(url: string): Promise<TransportConfig> {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Could not load game transport configuration.');
    const value = await response.json() as { transport?: TransportConfig };
    if (!value.transport) throw new Error('The server has no WebTransport endpoint configured.');
    return value.transport;
  }
  private async acceptSnapshots(transport: BrowserTransport, message: (data: string) => void, generation: number): Promise<void> {
    const reader = transport.incomingUnidirectionalStreams.getReader(); this.accepting = reader;
    const active = new Set<Promise<void>>();
    try {
      while (generation === this.generation) {
        if (active.size >= 4) await Promise.race(active);
        const item = await reader.read(); if (item.done) break;
        const task = this.read(item.value, true, message, generation).catch(() => {
          // Reset/expired snapshot streams are intentionally disposable.
        }).finally(() => active.delete(task));
        active.add(task);
      }
    } finally { reader.releaseLock(); await Promise.allSettled(active); }
  }
  private async read(stream: ReadableStream<Uint8Array>, snapshot: boolean, message: (data: string) => void, generation: number): Promise<void> {
    const reader = stream.getReader(); this.readers.add(reader);
    const decoder = new FrameDecoder(snapshot ? MAX_SNAPSHOT_BYTES : MAX_CONTROL_BYTES);
    let count = 0; let snapshotText: string | undefined;
    const expiry = snapshot ? setTimeout(() => { void reader.cancel('stale snapshot').catch(() => {}); }, 2000) : undefined;
    try {
      while (generation === this.generation) {
        const item = await reader.read(); if (item.done) break;
        for (const text of decoder.push(item.value)) {
          if (snapshot) { if (++count !== 1) throw new Error('Multiple frames in a snapshot stream.'); snapshotText = text; }
          else message(text);
        }
      }
      decoder.finish();
      if (snapshot && snapshotText && generation === this.generation) {
        const value = JSON.parse(snapshotText) as { type?: string; now?: number };
        if (value.type !== 'snapshot' || typeof value.now !== 'number' || !Number.isFinite(value.now)) throw new Error('Invalid snapshot envelope.');
        if (value.now > this.newest) { this.newest = value.now; message(snapshotText); }
      }
    } finally { if (expiry) clearTimeout(expiry); this.readers.delete(reader); reader.releaseLock(); }
  }
  sendReliable(data: string): boolean {
    if (!this.writer) return false;
    let bytes: Uint8Array;
    try { bytes = encodeFrame(data); } catch { this.fail(this.generation); return false; }
    if (this.queued + bytes.length > 64_000) { this.fail(this.generation); return false; }
    const writer = this.writer, generation = this.generation; this.queued += bytes.length;
    this.tail = this.tail.then(async () => {
      if (generation !== this.generation) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([writer.write(bytes), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Congested connection')), 2000); })]);
      } finally { if (timer) clearTimeout(timer); if (generation === this.generation) this.queued -= bytes.length; }
    }).catch(() => this.fail(generation));
    return true;
  }
  sendLatest(data: string): boolean { return this.sendReliable(data); }
  private fail(generation: number): void {
    if (generation !== this.generation) return;
    const callback = this.closedCallback; this.close(); callback?.();
  }
  close(): void {
    this.generation++; this.closedCallback = undefined;
    for (const reader of this.readers) void reader.cancel().catch(() => {});
    this.readers.clear(); if (this.accepting) void this.accepting.cancel().catch(() => {}); this.accepting = undefined;
    if (this.writer) void this.writer.abort().catch(() => {}); this.writer = undefined;
    this.transport?.close(); this.transport = undefined; this.queued = 0; this.tail = Promise.resolve(); this.newest = -Infinity;
  }
}
