#!/usr/bin/env node
/** Run the built Rust server; optionally publish only that port through a Quick Tunnel. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const share = process.argv.includes('--share');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const binary = resolve(root, process.env.ECHO_SERVER_BIN || `target/release/echo-server${process.platform === 'win32' ? '.exe' : ''}`);
await access(binary).catch(() => { throw new Error('Rust server missing. Run npm run build first, or use npm run play / npm run share.'); });
const key = process.env.ECHO_ACCESS_KEY || (share ? randomBytes(24).toString('hex') : '');
const control = randomBytes(32).toString('hex');
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), ECHO_ACCESS_KEY: key, ECHO_CONTROL_TOKEN: control };
const local = `http://127.0.0.1:${port}`;
const invitation = origin => `${origin}/${key ? `#key=${encodeURIComponent(key)}` : ''}`;
const children = new Set(); let stopping = false; let failed = null;
function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: 'inherit', ...options });
  children.add(child);
  child.on('error', error => { failed = error; stop(1); });
  child.on('exit', code => { children.delete(child); if (!stopping) { failed = new Error(`${command} exited (${code ?? 'signal'}).`); stop(code || 1); } });
  return child;
}
function stop(code = 0) {
  if (stopping) return; stopping = true; process.exitCode = code;
  if (failed) console.error(failed.message);
  for (const child of children) child.kill('SIGTERM');
  const force = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 2500); force.unref();
}
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
try {
  if (share) {
    await new Promise((resolve, reject) => {
      const probe = spawn('cloudflared', ['--version'], { windowsHide: true, stdio: 'ignore' });
      probe.once('error', () => reject(new Error('Install cloudflared and add it to PATH; see docs/LOCAL_PLAY.md. No tunnel was started.')));
      probe.once('exit', code => code === 0 ? resolve() : reject(new Error('cloudflared --version failed.')));
    });
  }
  // Refuse a busy port rather than accidentally publishing another application.
  const { createServer } = await import('node:net');
  await new Promise((resolve, reject) => { const test = createServer(); test.once('error', () => reject(new Error(`Port ${port} is busy. Stop the existing server or choose another PORT.`))); test.listen(port, '127.0.0.1', () => test.close(resolve)); });
  launch(binary, []);
  let ready = false;
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    try { const response = await fetch(`${local}/health`, { signal: AbortSignal.timeout(500) }); const body = await response.json(); if (body.ok && body.server === 'rust' && body.protocolVersion === 2) { ready = true; break; } } catch {}
    await sleep(100);
  }
  if (!ready) throw failed || new Error('The Rust server did not become ready. Check the output above.');
  console.log(`\nLOCAL PLAY: ${invitation(local)}\nCreate a private room in the browser. Ctrl+C stops the server.\n`);
  if (share) {
    let resolveUrl, rejectUrl;
    const found = new Promise((resolve, reject) => { resolveUrl = resolve; rejectUrl = reject; });
    // This is an explicit user-invoked public tunnel. Never tunnel the Vite development server.
    const tunnel = launch('cloudflared', ['tunnel', '--url', local, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    function read(chunk) {
      const text = chunk.toString(); process.stderr.write(text); tail = (tail + text).slice(-8000);
      const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
      if (match) resolveUrl(match[0]);
    }
    tunnel.stdout.on('data', read); tunnel.stderr.on('data', read);
    tunnel.once('error', rejectUrl); tunnel.once('exit', () => rejectUrl(new Error('Tunnel stopped before a public address was available.')));
    const timeout = setTimeout(() => rejectUrl(new Error('No tunnel URL received. Check cloudflared connectivity and any existing config.yaml; see docs/LOCAL_PLAY.md.')), 60_000);
    let origin; try { origin = await found; } finally { clearTimeout(timeout); }
    const response = await fetch(`${local}/api/public-url`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-echo-control': control },
      body: JSON.stringify({ url: origin }), signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error('Could not register the public invite address. Stopping to avoid giving friends a broken link.');
    console.log(`\nFRIENDS JOIN HERE: ${invitation(origin)}\nOpen the local link above, create a room, then COPY LINK for the room-specific invite.\nKeep this terminal and PC running. Treat the complete link as a password.\n`);
  }
} catch (error) { failed = error; stop(1); }
