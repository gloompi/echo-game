import type { ClientMessage, ServerMessage, Snapshot } from '../shared/types.js';
export class Connection {
  ws?: WebSocket;
  ping = 0;
  offset = 0;
  synced = false;
  private pingTimer?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private intentionalClose = false;
  constructor(private snapshot: (s: Snapshot) => void, private failure: (reason: string) => void) {}
  connect(join: Extract<ClientMessage, { type: 'join' }>): void {
    this.close(); this.intentionalClose = false; this.synced = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/socket`); this.ws = ws;
    this.timeout = setTimeout(() => { if (ws === this.ws) { this.failure('The server did not respond. Run npm run dev, or check your host.'); this.close(); } }, 9000);
    ws.onopen = () => {
      this.send(join); this.send({ type: 'ping', at: performance.now() });
      this.pingTimer = setInterval(() => this.send({ type: 'ping', at: performance.now() }), 2000);
    };
    ws.onmessage = event => {
      let msg: ServerMessage; try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'welcome') { if (this.timeout) clearTimeout(this.timeout); }
      else if (msg.type === 'snapshot') {
        if (this.timeout) clearTimeout(this.timeout);
        if (!this.synced) this.offset = msg.now - performance.now();
        this.snapshot(msg);
      } else if (msg.type === 'pong') {
        const now = performance.now(), rtt = now - msg.at;
        if (rtt < 3000) { this.ping = rtt; const offset = msg.now + rtt / 2 - now; this.offset = this.synced ? this.offset * 0.8 + offset * 0.2 : offset; this.synced = true; }
      } else if (msg.type === 'error') { this.failure(msg.message); this.close(); }
    };
    ws.onerror = () => { /* close or timeout reports a single actionable error */ };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer); if (this.timeout) clearTimeout(this.timeout);
      if (ws === this.ws && !this.intentionalClose) this.failure('Connection lost. Rejoin from the menu; rooms are not saved when the server stops.');
    };
  }
  send(message: ClientMessage): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message)); }
  close(): void {
    this.intentionalClose = true;
    if (this.pingTimer) clearInterval(this.pingTimer); if (this.timeout) clearTimeout(this.timeout);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = undefined; }
  }
  get now() { return performance.now() + this.offset; }
}
