import type { ClientMessage, ServerMessage, Snapshot } from '../shared/types.js';
import { type GameTransport, WebSocketTransport } from './transport.js';
export class Connection {
  ping = 0; offset = 0; synced = false; publicUrl: string | null = null;
  private transport?: GameTransport;
  private pingTimer?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;
  constructor(private snapshot: (s: Snapshot) => void, private failure: (reason: string) => void,
    private warning: (reason: string) => void = () => {}, private factory: () => GameTransport = () => new WebSocketTransport()) {}
  connect(join: Extract<ClientMessage, { type: 'join' }>): void {
    this.close(); this.synced = false; this.publicUrl = null;
    const generation = this.generation, transport = this.factory(); this.transport = transport;
    const fail = (reason: string) => { if (generation !== this.generation) return; this.close(); this.failure(reason); };
    this.timeout = setTimeout(() => fail('The server did not respond. Run npm run play, or check the host connection.'), 10_000);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    void transport.connect(`${protocol}//${location.host}/socket`, data => {
      if (generation !== this.generation) return;
      let msg: ServerMessage; try { msg = JSON.parse(data); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'welcome') {
        if (msg.protocolVersion !== 2) { fail('Client/server versions differ. Rebuild and restart Echo.'); return; }
        if (this.timeout) clearTimeout(this.timeout); this.publicUrl = msg.publicUrl ?? null;
      } else if (msg.type === 'snapshot') {
        if (this.timeout) clearTimeout(this.timeout);
        if (!this.synced) this.offset = msg.now - performance.now();
        this.snapshot(msg);
      } else if (msg.type === 'pong') {
        const now = performance.now(), rtt = now - msg.at;
        if (Number.isFinite(rtt) && rtt >= 0 && rtt < 3000) {
          this.ping = rtt; const offset = msg.now + rtt / 2 - now;
          this.offset = this.synced ? this.offset * 0.8 + offset * 0.2 : offset; this.synced = true;
        }
      } else if (msg.type === 'error') {
        if (msg.fatal === false) this.warning(msg.message); else fail(msg.message);
      }
    }, () => fail('Connection lost. Rejoin from the menu. The host PC and tunnel must remain running.')).then(() => {
      if (generation !== this.generation) return;
      const accessKey = new URLSearchParams(location.hash.slice(1)).get('key') ?? undefined;
      this.send({ ...join, accessKey: join.accessKey ?? accessKey });
      this.send({ type: 'ping', at: performance.now() });
      this.pingTimer = setInterval(() => this.send({ type: 'ping', at: performance.now() }), 2000);
    }).catch(error => fail(error instanceof Error ? error.message : 'Connection failed.'));
  }
  send(message: ClientMessage): boolean {
    if (!this.transport) return false;
    const data = JSON.stringify(message);
    const sent = message.type === 'input' ? this.transport.sendLatest(data) : this.transport.sendReliable(data);
    if (!sent && this.transport.bufferedAmount > 64_000) {
      this.close(); this.failure('The connection is too congested. Stop large uploads and rejoin.');
    }
    return sent;
  }
  close(): void {
    this.generation++;
    if (this.pingTimer) clearInterval(this.pingTimer); if (this.timeout) clearTimeout(this.timeout);
    this.transport?.close(); this.transport = undefined;
  }
  async invite(room: string): Promise<string> {
    // A localhost player may have joined before cloudflared announced its URL.
    try {
      const response = await fetch('/api/config', { signal: AbortSignal.timeout(2000), cache: 'no-store' });
      if (response.ok) { const config = await response.json(); if (typeof config.publicUrl === 'string') this.publicUrl = config.publicUrl; }
    } catch { /* Keep the last verified welcome URL when the config request fails. */ }
    const url = new URL(this.publicUrl || location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid public game URL.');
    url.search = ''; url.searchParams.set('room', room);
    // The access key stays out of ordinary HTTP request logs and Referrer headers.
    url.hash = location.hash; return url.toString();
  }
  get now() { return performance.now() + this.offset; }
}
