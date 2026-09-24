import type { ClientMessage, ServerMessage, Snapshot } from '../../shared/types.js';
import { type GameTransport, WebTransportTransport } from '../transport.js';
import { ServerClock, SnapshotCursor } from './clock.js';
import {
  createInviteUrl,
  fragmentAccessKey,
  readPublicUrl,
  type InviteLocation,
} from './invite.js';

type JoinMessage = Extract<ClientMessage, { type: 'join' }>;

const CONFIG_URL = '/api/config';
const PROTOCOL_VERSION = 3;
const CONNECT_TIMEOUT_MS = 12_000;
const PING_INTERVAL_MS = 2_000;
const MAX_BUFFERED_BYTES = 64_000;

export interface ConnectionEnvironment {
  readonly now: () => number;
  readonly location: () => InviteLocation;
  readonly fetch: typeof globalThis.fetch;
}

const browserEnvironment: ConnectionEnvironment = {
  now: () => performance.now(),
  location: () => ({ origin: location.origin, hash: location.hash }),
  fetch: (...args) => fetch(...args),
};

/** Owns one session. Transport, clock policy, and invitation policy stay separate. */
export class Connection {
  publicUrl: string | null = null;
  private transport?: GameTransport;
  private pingTimer?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private readonly cursor = new SnapshotCursor();
  private readonly clock: ServerClock;

  constructor(
    private readonly snapshot: (snapshot: Snapshot) => void,
    private readonly failure: (reason: string) => void,
    private readonly warning: (reason: string) => void = () => {},
    private readonly factory: () => GameTransport = () => new WebTransportTransport(),
    private readonly environment: ConnectionEnvironment = browserEnvironment,
  ) {
    this.clock = new ServerClock(environment.now);
  }

  get ping(): number {
    return this.clock.ping;
  }
  get offset(): number {
    return this.clock.offset;
  }
  get synced(): boolean {
    return this.clock.synced;
  }
  get now(): number {
    return this.clock.now;
  }

  connect(join: JoinMessage): void {
    this.close();
    this.clock.reset();
    this.cursor.reset();
    this.publicUrl = null;
    const generation = this.generation;
    const fail = (reason: string): void => this.fail(generation, reason);

    // Factories and adapters may throw before returning a promise.
    try {
      const transport = this.factory();
      this.transport = transport;
      this.timeout = setTimeout(
        () =>
          fail(
            'WebTransport connection timed out. Check the UDP endpoint, certificate, browser support and host connection.',
          ),
        CONNECT_TIMEOUT_MS,
      );

      void transport
        .connect(
          CONFIG_URL,
          (message) => this.receive(generation, message),
          () =>
            fail(
              'Connection lost. Rejoin from the menu. The host PC and UDP endpoint must remain reachable.',
            ),
        )
        .then(() => this.beginSession(generation, join))
        .catch((error) => {
          fail(error instanceof Error ? error.message : 'Connection failed.');
        });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Connection failed.');
    }
  }

  private beginSession(generation: number, join: JoinMessage): void {
    if (generation !== this.generation) return;
    const accessKey = join.accessKey ?? fragmentAccessKey(this.environment.location().hash);
    if (!this.send({ ...join, accessKey })) {
      this.fail(generation, 'Could not send the room request. Rejoin from the menu.');
      return;
    }
    if (generation !== this.generation) return;
    if (!this.send({ type: 'ping', at: this.environment.now() })) {
      this.fail(generation, 'Could not synchronize with the server. Rejoin from the menu.');
      return;
    }
    // A synchronous close during either send must not leave a keepalive behind.
    if (generation !== this.generation) return;
    this.pingTimer = setInterval(() => {
      if (generation === this.generation) {
        this.send({ type: 'ping', at: this.environment.now() });
      }
    }, PING_INTERVAL_MS);
  }

  private receive(generation: number, message: ServerMessage): void {
    if (generation !== this.generation || !message || typeof message !== 'object') return;
    switch (message.type) {
      case 'welcome':
        if (message.protocolVersion !== PROTOCOL_VERSION) {
          this.fail(generation, 'Client/server versions differ. Rebuild and restart Echo.');
          return;
        }
        this.publicUrl = message.publicUrl ?? null;
        return;
      case 'snapshot':
        if (!this.cursor.accept(message.now)) return;
        this.clearConnectTimeout();
        this.clock.observeSnapshot(message.now);
        this.snapshot(message);
        return;
      case 'pong':
        this.clock.observePong(message.at, message.now);
        return;
      case 'error':
        if (message.fatal === false) this.warning(message.message);
        else this.fail(generation, message.message);
    }
  }

  send(message: ClientMessage): boolean {
    const transport = this.transport;
    if (!transport) return false;
    const data = JSON.stringify(message);
    const sent =
      message.type === 'input' ? transport.sendLatest(data) : transport.sendReliable(data);
    if (!sent && this.transport === transport && transport.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.fail(this.generation, 'The connection is too congested. Stop large uploads and rejoin.');
    }
    return sent;
  }

  private fail(generation: number, reason: string): void {
    if (generation !== this.generation) return;
    this.close();
    this.failure(reason);
  }

  private clearConnectTimeout(): void {
    if (this.timeout !== undefined) clearTimeout(this.timeout);
    this.timeout = undefined;
  }

  close(): void {
    this.generation++;
    if (this.pingTimer !== undefined) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    this.clearConnectTimeout();
    const transport = this.transport;
    this.transport = undefined;
    transport?.close();
  }

  async invite(room: string): Promise<string> {
    const generation = this.generation;
    let publicUrl = this.publicUrl;
    const currentLocation = this.environment.location();
    try {
      const response = await this.environment.fetch(CONFIG_URL, {
        signal: AbortSignal.timeout(2_000),
        cache: 'no-store',
      });
      if (response.ok) {
        const value: unknown = await response.json();
        const discovered = readPublicUrl(value);
        if (discovered !== undefined) {
          // Validate before remembering configuration; retain the last usable URL on failure.
          createInviteUrl(room, currentLocation, discovered);
          publicUrl = discovered;
          if (generation === this.generation) this.publicUrl = discovered;
        }
      }
    } catch {
      // Discovery is optional: the last welcome URL or local origin remains usable.
    }
    return createInviteUrl(room, currentLocation, publicUrl);
  }
}
