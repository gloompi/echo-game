import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';

async function connect(origin, join) {
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/socket'); const messages = [];
  ws.addEventListener('message', event => { messages.push(JSON.parse(event.data)); if (messages.length > 256) messages.shift(); });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) { const found = messages.find(predicate); if (found) return found; if (ws.readyState === WebSocket.CLOSED) throw new Error('Socket closed before expected message'); await sleep(25); }
    throw new Error(`No matching message; last: ${JSON.stringify(messages.at(-1))}`);
  };
  ws.send(JSON.stringify(join));
  return { ws, wait, messages, send: message => ws.send(JSON.stringify(message)) };
}
test('Rust HTTP + WebSocket protocol, settings, access key, room capacity and host transfer', { timeout: 30000 }, async () => {
  const allocator = createServer(); await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve));
  const port = allocator.address().port; await new Promise(resolve => allocator.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const binary = resolve(`target/debug/echo-server${process.platform === 'win32' ? '.exe' : ''}`);
  const server = spawn(binary, [], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ECHO_ACCESS_KEY: 'integration-key', ECHO_CONTROL_TOKEN: 'integration-control', ECHO_PUBLIC_URL: '', ALLOWED_ORIGINS: '', ECHO_DELAY_MS: '3000' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '', spawnError; server.on('error', error => { spawnError = error; });
  server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-50000); }); server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-50000); });
  const clients = [];
  async function peer(message) { const p = await connect(origin, { type: 'join', accessKey: 'integration-key', name: 'Tester', ...message }); clients.push(p); return p; }
  try {
    let health;
    for (let i = 0; i < 100; i++) {
      if (spawnError) throw spawnError;
      try { health = await (await fetch(origin + '/health', { signal: AbortSignal.timeout(100) })).json(); if (health.ok) break; } catch {}
      await sleep(25);
    }
    assert.equal(health?.server, 'rust', logs); assert.equal(health.tickRate, 60); assert.equal(health.snapshotRate, 20);
    const index = await fetch(origin + '/'); assert.equal(index.status, 200, 'Build the client before integration testing'); assert.match(await index.text(), /ECHO/);
    const forbidden = await peer({ mode: 'create', accessKey: 'wrong' }); assert.equal((await forbidden.wait(s => s.type === 'error')).fatal, true); forbidden.ws.close();
    const host = await peer({ mode: 'create', preference: 'seeker' }); const welcome = await host.wait(s => s.type === 'welcome');
    const friend = await peer({ mode: 'join', room: welcome.room, preference: 'hider' }); const friendWelcome = await friend.wait(s => s.type === 'welcome');
    const settings = { delayMs: 1250, roundMs: 90000, seekerCount: 1 };
    friend.send({ type: 'settings', settings }); assert.equal((await friend.wait(s => s.type === 'error')).fatal, false);
    host.send({ type: 'bots', enabled: false }); host.send({ type: 'settings', settings });
    const configured = await friend.wait(s => s.type === 'snapshot' && s.settings.delayMs === 1250); assert.deepEqual(configured.settings, settings);
    host.send({ type: 'start' });
    const warmup = await host.wait(s => s.type === 'snapshot' && s.phase === 'headstart');
    assert.equal(warmup.self.role, 'seeker'); assert.equal(warmup.players.filter(p => p.role === 'hider').length, 0);
    assert.ok(Math.abs(warmup.now - warmup.viewTime - 1250) < 1e-6);
    host.send({ type: 'settings', settings: { ...settings, delayMs: 0 } });
    assert.equal((await host.wait(s => s.type === 'error')).fatal, false);
    const before = await friend.wait(s => s.type === 'snapshot' && s.phase === 'headstart');
    friend.send({ type: 'input', input: { seq: 1, mx: 0, mz: 1, yaw: 0, pitch: 0, sprint: false, jump: false, dash: false, shoot: false, reload: false, wave: false } });
    await friend.wait(s => s.type === 'snapshot' && s.self.ack >= 1 && s.self.z < before.self.z - 0.05);
    const delayed = await host.wait(s => s.type === 'snapshot' && s.phase === 'headstart' && s.players.some(p => p.id === friendWelcome.id));
    assert.ok(Math.abs(delayed.now - delayed.viewTime - 1250) < 1e-6); assert.ok(!delayed.roster.some(p => 'x' in p || 'motor' in p));
    host.send({ type: 'lobby' }); await host.wait(s => s.type === 'snapshot' && s.phase === 'lobby' && s.round === 1);
    host.send({ type: 'settings', settings: { ...settings, delayMs: 0 } }); await friend.wait(s => s.type === 'snapshot' && s.settings.delayMs === 0);
    host.send({ type: 'start' }); const live = await host.wait(s => s.type === 'snapshot' && s.round === 2 && s.phase === 'headstart');
    assert.equal(live.now, live.viewTime); assert.ok(live.players.some(p => p.id === friendWelcome.id));
    const forbiddenConfig = await fetch(origin + '/api/public-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://friends.example' }) }); assert.equal(forbiddenConfig.status, 403);
    const published = await fetch(origin + '/api/public-url', { method: 'POST', headers: { 'content-type': 'application/json', 'x-echo-control': 'integration-control' }, body: JSON.stringify({ url: 'https://friends.example' }) }); assert.equal(published.status, 204);
    assert.equal((await (await fetch(origin + '/api/config')).json()).publicUrl, 'https://friends.example');
    for (let i = 0; i < 10; i++) { const p = await peer({ mode: 'join', room: welcome.room }); await p.wait(s => s.type === 'welcome'); }
    const full = await peer({ mode: 'join', room: welcome.room }); assert.match((await full.wait(s => s.type === 'error')).message, /full/); full.ws.close();
    host.ws.close(); await friend.wait(s => s.type === 'snapshot' && s.host === friendWelcome.id);
  } catch (error) { console.error(logs); throw error; }
  finally {
    for (const client of clients) client.ws.close();
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), sleep(2500).then(() => server.kill('SIGKILL'))]);
  }
});
