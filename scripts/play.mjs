#!/usr/bin/env node
/** Local is loopback-only. Public sharing explicitly exposes HTTP + a configured UDP game endpoint. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer } from 'node:net';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const share = process.argv.includes('--share');
const port = Number(process.env.PORT || 3000),
  wtPort = Number(process.env.ECHO_WT_PORT || 4433);
for (const [name, value] of [
  ['PORT', port],
  ['ECHO_WT_PORT', wtPort],
])
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw Error(`${name} must be an integer from 1 to 65535.`);
const publicWT = process.env.ECHO_WT_PUBLIC_URL || '';
if (share) {
  let url;
  try {
    url = new URL(publicWT);
  } catch {
    // Invalid probe results are handled by the validation/readiness check below.
  }
  if (
    !url ||
    url.protocol !== 'https:' ||
    url.pathname !== '/echo' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw Error(
      'Sharing requires ECHO_WT_PUBLIC_URL=https://YOUR-UDP-HOST:4433/echo. Forward UDP 4433 to this PC (or use an appropriate UDP relay). A Cloudflare HTTP Quick Tunnel alone is not a WebTransport game endpoint. See docs/ABILITIES_AND_TRANSPORT.md. No tunnel was started.',
    );
  }
}
const binary = resolve(
  root,
  process.env.ECHO_SERVER_BIN ||
    `target/release/echo-server${process.platform === 'win32' ? '.exe' : ''}`,
);
await access(binary).catch(() => {
  throw Error('Rust server missing. Run npm run build first.');
});
const key = process.env.ECHO_ACCESS_KEY || (share ? randomBytes(24).toString('hex') : '');
const control = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(port),
  ECHO_ACCESS_KEY: key,
  ECHO_CONTROL_TOKEN: control,
  ECHO_WT_PORT: String(wtPort),
  ECHO_WT_HOST: share ? process.env.ECHO_WT_HOST || '0.0.0.0' : '127.0.0.1',
  ECHO_WT_PUBLIC_URL: share ? publicWT : '',
  ECHO_PUBLIC_URL: '',
};
const local = `http://127.0.0.1:${port}`;
const invitation = (origin) => `${origin}/${key ? `#key=${encodeURIComponent(key)}` : ''}`;
const children = new Set();
let stopping = false,
  failed = null;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  if (failed) console.error(failed.message);
  for (const child of children) child.kill('SIGTERM');
  const force = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 2500);
  force.unref();
}
function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: 'inherit',
    ...options,
  });
  children.add(child);
  child.on('error', (error) => {
    failed = error;
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      failed = Error(`${command} exited (${code ?? 'signal'}).`);
      stop(code || 1);
    }
  });
  return child;
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
try {
  if (share)
    await new Promise((resolve, reject) => {
      const probe = spawn('cloudflared', ['--version'], { windowsHide: true, stdio: 'ignore' });
      probe.once('error', () =>
        reject(Error('Install cloudflared and add it to PATH. No tunnel was started.')),
      );
      probe.once('exit', (code) =>
        code === 0 ? resolve() : reject(Error('cloudflared --version failed.')),
      );
    });
  await new Promise((resolve, reject) => {
    const test = createServer();
    test.once('error', () =>
      reject(Error(`Port ${port} is busy. Stop the existing server or choose another PORT.`)),
    );
    test.listen(port, '127.0.0.1', () => test.close(resolve));
  });
  launch(binary, []);
  let ready = false;
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    try {
      const response = await fetch(`${local}/health`, { signal: AbortSignal.timeout(500) });
      const body = await response.json();
      if (
        body.ok &&
        body.server === 'rust' &&
        body.protocolVersion === 3 &&
        body.transport === 'webtransport'
      ) {
        ready = true;
        break;
      }
    } catch {
      // Invalid probe results are handled by the validation/readiness check below.
    }
    await sleep(100);
  }
  if (!ready)
    throw (
      failed ||
      Error('The protocol-v3 Rust server did not become ready. Rebuild and check the output above.')
    );
  console.log(
    `\nLOCAL PLAY: ${invitation(local)}\nGame transport: UDP ${wtPort}. Ctrl+C stops the server.\n`,
  );
  if (share) {
    let resolveUrl, rejectUrl;
    const found = new Promise((resolve, reject) => {
      resolveUrl = resolve;
      rejectUrl = reject;
    });
    // Only the built static/API server is tunneled, never Vite or source files.
    const tunnel = launch('cloudflared', ['tunnel', '--url', local, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let tail = '';
    function read(chunk) {
      const text = chunk.toString();
      process.stderr.write(text);
      tail = (tail + text).slice(-8000);
      const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
      if (match) resolveUrl(match[0]);
    }
    tunnel.stdout.on('data', read);
    tunnel.stderr.on('data', read);
    tunnel.once('error', rejectUrl);
    tunnel.once('exit', () =>
      rejectUrl(Error('Tunnel stopped before a public address was available.')),
    );
    const timeout = setTimeout(
      () => rejectUrl(Error('No frontend tunnel URL received. Check cloudflared connectivity.')),
      60_000,
    );
    let origin;
    try {
      origin = await found;
    } finally {
      clearTimeout(timeout);
    }
    const response = await fetch(`${local}/api/public-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-echo-control': control },
      body: JSON.stringify({ url: origin }),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok)
      throw Error(
        'Could not register the public invite address. Stopping rather than advertising an unconfigured transport.',
      );
    console.log(
      `\nFRONTEND INVITE: ${invitation(origin)}\nGAME UDP ENDPOINT: ${publicWT}\nThe launcher validates configuration, not Internet UDP reachability. Verify the game connection from an external network before inviting everyone.\nKeep this terminal and PC running. Treat the complete #key= link as a password.\n`,
    );
  }
} catch (error) {
  failed = error;
  stop(1);
}
