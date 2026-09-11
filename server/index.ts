import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
import { randomInt } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import { CFG } from '../shared/config.js';
import { parseMessage } from './validation.js';
import { createPlayer, Room, type Player } from './room.js';
import type { ServerMessage } from '../shared/types.js';
const PORT = Number(process.env.PORT ?? 3000), HOST = process.env.HOST ?? '0.0.0.0';
const MAX_ROOMS = Math.max(1, Math.min(256, Number(process.env.MAX_ROOMS) || 64));
const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '../client');
const rooms = new Map<string, Room>();
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.humanCount, 0) })); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url ?? '/', 'http://local');
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(clientDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(clientDir + sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Content-Length': info.size,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('ECHO — asset not found. For local development run npm run dev; for production run npm run build first.'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
interface Session { ws: WebSocket; room?: Room; player?: Player; alive: boolean; count: number; window: number; ip: string }
const sessions = new Set<Session>();
const ipCounts = new Map<string, number>();
const send = (ws: WebSocket, message: ServerMessage) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 128_000) ws.send(JSON.stringify(message)); };
server.on('upgrade', (req, socket, head) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  let originOK = false;
  try { originOK = !req.headers.origin || (allowedOrigins.length ? allowedOrigins.includes(req.headers.origin) : new URL(req.headers.origin).host === req.headers.host); } catch { /* reject malformed origin */ }
  if (req.url !== '/socket' || !originOK || (ipCounts.get(ip) ?? 0) >= 24 || sessions.size >= 256) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  const session: Session = { ws, ip, alive: true, count: 0, window: performance.now() };
  sessions.add(session); ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
  const joinTimeout = setTimeout(() => { if (!session.room) ws.close(1008, 'Join timeout'); }, 10_000);
  ws.on('pong', () => { session.alive = true; });
  ws.on('error', () => { /* close handler owns cleanup */ });
  ws.on('message', (data, binary) => {
    const now = performance.now();
    if (now - session.window > 1000) { session.window = now; session.count = 0; }
    if (++session.count > 90 || binary) { ws.close(1008, 'Message rate or type not allowed'); return; }
    const message = parseMessage(data.toString());
    if (!message) { ws.close(1008, 'Invalid message'); return; }
    if (message.type === 'ping') { send(ws, { type: 'pong', at: message.at, now }); return; }
    if (message.type === 'join') {
      if (session.room) return;
      let room: Room | undefined;
      if (message.mode === 'join') {
        room = rooms.get(message.room ?? '');
        if (!room || room.practice) { send(ws, { type: 'error', message: 'Room not found. Check the six-character code.' }); return; }
      } else if (message.mode === 'quick') room = [...rooms.values()].find(r => r.isPublic && r.players.size < CFG.maxPlayers && r.phase !== 'finished');
      if (!room) {
        if (rooms.size >= MAX_ROOMS) { send(ws, { type: 'error', message: 'The server is full. Try again shortly.' }); return; }
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code: string;
        do { code = Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join(''); } while (rooms.has(code));
        room = new Room(code, message.mode === 'quick', message.mode === 'practice', now); rooms.set(code, room);
      }
      const player = createPlayer(message.name, now, false, message.preference);
      if (!room.add(player, now)) { send(ws, { type: 'error', message: 'This room is full (8 players).' }); return; }
      session.room = room; session.player = player; clearTimeout(joinTimeout);
      if (message.mode === 'practice' || message.mode === 'quick') room.start(now);
      send(ws, { type: 'welcome', id: player.id, room: room.code }); send(ws, room.snapshot(player, now));
      return;
    }
    const { room, player } = session; if (!room || !player) return;
    if (message.type === 'input') room.setInput(player, message.input, now);
    if (message.type === 'start' && room.host === player.id && room.phase === 'lobby' && !room.start(now)) send(ws, { type: 'error', message: 'Invite a friend or enable practice bots before starting.' });
    if (message.type === 'preference' && room.phase === 'lobby') player.preference = message.value;
    if (message.type === 'bots' && room.host === player.id && room.phase === 'lobby') room.botsEnabled = message.enabled;
  });
  ws.on('close', () => {
    clearTimeout(joinTimeout); sessions.delete(session); session.room?.remove(session.player?.id ?? '');
    const n = (ipCounts.get(ip) ?? 1) - 1; if (n <= 0) ipCounts.delete(ip); else ipCounts.set(ip, n);
    if (session.room && !session.room.humanCount) rooms.delete(session.room.code);
  });
});
let previous = performance.now(), accumulator = 0, tick = 0;
const loop = setInterval(() => {
  const now = performance.now(); accumulator += Math.min(250, now - previous); previous = now;
  let steps = 0;
  while (accumulator >= 1000 / CFG.tickRate && steps++ < 6) {
    accumulator -= 1000 / CFG.tickRate; const at = now - accumulator;
    for (const room of rooms.values()) room.tick(at); tick++;
    if (tick % 2 === 0) for (const s of sessions) {
      if (s.ws.bufferedAmount > 512_000) { s.ws.close(1013, 'Connection too slow'); continue; }
      if (s.room && s.player) send(s.ws, s.room.snapshot(s.player, at));
    }
  }
}, 8);
const heartbeat = setInterval(() => { for (const s of sessions) { if (!s.alive) s.ws.terminate(); else { s.alive = false; s.ws.ping(); } } }, 15_000);
function shutdown() { clearInterval(loop); clearInterval(heartbeat); for (const s of sessions) s.ws.close(1001, 'Server restarting'); server.close(); setTimeout(() => process.exit(0), 500).unref(); }
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
server.listen(PORT, HOST, () => console.log(`ECHO server listening on http://${HOST}:${PORT} — 30 Hz, 3000 ms seeker holdback`));
