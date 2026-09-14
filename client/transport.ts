import {
  encodeFrame,
  FrameDecoder,
  MAX_CONTROL_BYTES,
  MAX_SNAPSHOT_BYTES,
} from '../shared/framing.js';
import type { ServerMessage } from '../shared/types.js';
import {
  readTransportConfig,
  resolveTransportConfig,
  type TransportConfig,
} from './network/transport-config.js';

export type { TransportConfig } from './network/transport-config.js';

export interface GameTransport {
  readonly bufferedAmount: number;
  connect(url: string, message: (data: ServerMessage) => void, closed: () => void): Promise<void>;
  sendReliable(data: string): boolean;
  sendLatest(data: string): boolean;
  close(): void;
}

interface BiStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

interface BrowserTransport {
  ready: Promise<void>;
  closed: Promise<unknown>;
  createBidirectionalStream(): Promise<BiStream>;
  incomingUnidirectionalStreams: ReadableStream<ReadableStream<Uint8Array>>;
  close(): void;
}

export type TransportFactory = (
  url: string,
  options: { serverCertificateHashes?: { algorithm: string; value: Uint8Array }[] },
) => BrowserTransport;

const MAX_QUEUED_BYTES = 64_000;
const MAX_SNAPSHOT_STREAMS = 4;
const STREAM_TIMEOUT_MS = 2_000;

const browserFactory: TransportFactory = (url, options) => {
  const Constructor = (
    globalThis as unknown as {
      WebTransport?: new (url: string, options: unknown) => BrowserTransport;
    }
  ).WebTransport;
  if (!Constructor) {
    throw new Error(
      'This browser does not support WebTransport. Use a WebTransport-capable browser on HTTPS or localhost.',
    );
  }
  return new Constructor(url, options);
};

function parseServerMessage(text: string): ServerMessage {
  const value = JSON.parse(text) as ServerMessage;
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') {
    throw new Error('Invalid server message.');
  }
  return value;
}

/**
 * Inputs stay ordered for deterministic prediction. Independent short-lived
 * snapshot streams prevent an old lost snapshot from blocking newer observations.
 * There is deliberately no WebSocket fallback.
 */
export class WebTransportTransport implements GameTransport {
  private transport?: BrowserTransport;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private readonly readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  private accepting?: ReadableStreamDefaultReader<ReadableStream<Uint8Array>>;
  private queued = 0;
  private generation = 0;
  private closedCallback?: () => void;
  private tail: Promise<void> = Promise.resolve();
  private newest = -Infinity;

  constructor(
    private readonly config?: TransportConfig,
    private readonly factory: TransportFactory = browserFactory,
  ) {}

  get bufferedAmount(): number {
    return this.queued;
  }

  async connect(
    url: string,
    message: (data: ServerMessage) => void,
    closed: () => void,
  ): Promise<void> {
    this.close();
    const generation = this.generation;
    this.closedCallback = closed;
    const config = this.config ?? (await this.discover(url));
    if (generation !== this.generation) throw new Error('Connection cancelled.');
    const hostname = typeof location === 'undefined' ? undefined : location.hostname;
    const { endpoint, options } = resolveTransportConfig(config, hostname);
    const transport = this.factory(endpoint, options);
    this.transport = transport;
    void transport.closed.then(
      () => this.fail(generation),
      () => this.fail(generation),
    );
    try {
      await transport.ready;
      if (generation !== this.generation) {
        transport.close();
        throw new Error('Connection cancelled.');
      }
      const stream = await transport.createBidirectionalStream();
      if (generation !== this.generation) {
        transport.close();
        throw new Error('Connection cancelled.');
      }
      this.writer = stream.writable.getWriter();
      void this.writer.closed.catch(() => this.fail(generation));
      void this.read(stream.readable, false, message, generation).then(
        () => this.fail(generation),
        () => this.fail(generation),
      );
      void this.acceptSnapshots(transport, message, generation).catch(() => this.fail(generation));
    } catch (error) {
      if (generation === this.generation) this.close();
      throw error;
    }
  }

  private async discover(url: string): Promise<TransportConfig> {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error('Could not load game transport configuration.');
    const value: unknown = await response.json();
    return readTransportConfig(value);
  }

  private async acceptSnapshots(
    transport: BrowserTransport,
    message: (data: ServerMessage) => void,
    generation: number,
  ): Promise<void> {
    const reader = transport.incomingUnidirectionalStreams.getReader();
    this.accepting = reader;
    const active = new Set<Promise<void>>();
    try {
      while (generation === this.generation) {
        if (active.size >= MAX_SNAPSHOT_STREAMS) await Promise.race(active);
        const item = await reader.read();
        if (item.done) break;
        const task = this.read(item.value, true, message, generation)
          .catch(() => {
            // Reset/expired snapshot streams are intentionally disposable.
          })
          .finally(() => active.delete(task));
        active.add(task);
      }
    } finally {
      reader.releaseLock();
      await Promise.allSettled(active);
    }
  }

  private async read(
    stream: ReadableStream<Uint8Array>,
    snapshot: boolean,
    message: (data: ServerMessage) => void,
    generation: number,
  ): Promise<void> {
    const reader = stream.getReader();
    this.readers.add(reader);
    const decoder = new FrameDecoder(snapshot ? MAX_SNAPSHOT_BYTES : MAX_CONTROL_BYTES);
    let count = 0;
    let snapshotMessage: ServerMessage | undefined;
    const expiry = snapshot
      ? setTimeout(() => {
          void reader.cancel('stale snapshot').catch(() => {});
        }, STREAM_TIMEOUT_MS)
      : undefined;
    try {
      while (generation === this.generation) {
        const item = await reader.read();
        if (generation !== this.generation) return;
        if (item.done) break;
        for (const text of decoder.push(item.value)) {
          const value = parseServerMessage(text);
          if (snapshot) {
            if (++count !== 1) throw new Error('Multiple frames in a snapshot stream.');
            snapshotMessage = value;
          } else {
            message(value);
          }
        }
      }
      decoder.finish();
      if (snapshot && snapshotMessage && generation === this.generation) {
        if (snapshotMessage.type !== 'snapshot' || !Number.isFinite(snapshotMessage.now)) {
          throw new Error('Invalid snapshot envelope.');
        }
        if (snapshotMessage.now > this.newest) {
          this.newest = snapshotMessage.now;
          message(snapshotMessage);
        }
      }
    } finally {
      if (expiry !== undefined) clearTimeout(expiry);
      this.readers.delete(reader);
      reader.releaseLock();
    }
  }

  sendReliable(data: string): boolean {
    if (!this.writer) return false;
    let bytes: Uint8Array;
    try {
      bytes = encodeFrame(data);
    } catch {
      this.fail(this.generation);
      return false;
    }
    if (this.queued + bytes.length > MAX_QUEUED_BYTES) {
      this.fail(this.generation);
      return false;
    }
    const writer = this.writer;
    const generation = this.generation;
    this.queued += bytes.length;
    this.tail = this.tail
      .then(async () => {
        if (generation !== this.generation) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            writer.write(bytes),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('Congested connection')),
                STREAM_TIMEOUT_MS,
              );
            }),
          ]);
        } finally {
          if (timer !== undefined) clearTimeout(timer);
          if (generation === this.generation) this.queued -= bytes.length;
        }
      })
      .catch(() => this.fail(generation));
    return true;
  }

  sendLatest(data: string): boolean {
    return this.sendReliable(data);
  }

  private fail(generation: number): void {
    if (generation !== this.generation) return;
    const callback = this.closedCallback;
    this.close();
    callback?.();
  }

  close(): void {
    this.generation++;
    this.closedCallback = undefined;
    for (const reader of this.readers) void reader.cancel().catch(() => {});
    this.readers.clear();
    if (this.accepting) void this.accepting.cancel().catch(() => {});
    this.accepting = undefined;
    if (this.writer) void this.writer.abort().catch(() => {});
    this.writer = undefined;
    this.transport?.close();
    this.transport = undefined;
    this.queued = 0;
    this.tail = Promise.resolve();
    this.newest = -Infinity;
  }
}
