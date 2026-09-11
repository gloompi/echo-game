/** Application delivery semantics, not a claim that WebSockets are unreliable. */
export interface GameTransport {
  readonly bufferedAmount: number;
  connect(url: string, message: (data: string) => void, closed: () => void): Promise<void>;
  sendReliable(data: string): boolean;
  sendLatest(data: string): boolean;
  close(): void;
}
export class WebSocketTransport implements GameTransport {
  private socket?: WebSocket;
  get bufferedAmount() { return this.socket?.bufferedAmount ?? 0; }
  connect(url: string, message: (data: string) => void, closed: () => void): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url); this.socket = ws;
      ws.onopen = () => resolve();
      ws.onmessage = event => { if (typeof event.data === 'string') message(event.data); };
      ws.onerror = () => reject(new Error('Could not connect to the game server.'));
      ws.onclose = () => { reject(new Error('The game connection closed.')); closed(); };
    });
  }
  sendReliable(data: string): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN || this.bufferedAmount > 128_000) return false;
    this.socket.send(data); return true;
  }
  sendLatest(data: string): boolean {
    // TCP remains reliable/ordered. Do not build an application queue of stale movement.
    return this.bufferedAmount <= 64_000 && this.sendReliable(data);
  }
  close(): void {
    if (this.socket) { this.socket.onclose = null; this.socket.onmessage = null; this.socket.onerror = null; this.socket.close(); this.socket = undefined; }
  }
}
