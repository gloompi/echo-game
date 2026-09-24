#!/usr/bin/env node
// @ts-check
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Real production server, never a mock or a user's public playtest configuration.
 * @param {NodeJS.ProcessEnv} inherited @param {string} root @returns {NodeJS.ProcessEnv}
 */
export function e2eEnvironment(inherited, root) {
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (key.startsWith('ECHO_') || ['HOST', 'PORT', 'ALLOWED_ORIGINS', 'MAX_ROOMS'].includes(key))
      delete env[key];
  }
  return {
    ...env,
    HOST: '127.0.0.1',
    PORT: '3107',
    ECHO_WT_HOST: '127.0.0.1',
    ECHO_WT_PORT: '4447',
    ECHO_ACCESS_KEY: '',
    ECHO_PUBLIC_URL: '',
    ECHO_WT_PUBLIC_URL: '',
    ECHO_DELAY_MS: '3000',
    ECHO_CLIENT_DIR: join(root, 'dist/client'),
    ALLOWED_ORIGINS: 'http://127.0.0.1:3107',
    MAX_ROOMS: '32',
  };
}

/** @param {string} root @returns {void} */
function serve(root) {
  const binary = join(
    root,
    `target/release/echo-server${process.platform === 'win32' ? '.exe' : ''}`,
  );
  if (!existsSync(binary) || !existsSync(join(root, 'dist/client/index.html'))) {
    throw new Error(
      'Production build missing. Run pnpm test:e2e, or pnpm build before test:e2e:built.',
    );
  }
  const workdir = mkdtempSync(join(tmpdir(), 'echo-e2e-'));
  // dotenvy stops here instead of loading a .env from the project or a parent directory.
  writeFileSync(join(workdir, '.env'), '');
  const child = spawn(binary, [], {
    cwd: workdir,
    env: e2eEnvironment(process.env, root),
    stdio: 'inherit',
  });
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let force;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    child.kill('SIGTERM');
    force = setTimeout(() => child.kill('SIGKILL'), 2_500);
    force.unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  child.once('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once('close', (code) => {
    if (force !== undefined) clearTimeout(force);
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    rmSync(workdir, { recursive: true, force: true });
    process.exitCode = process.exitCode || code || (stopping ? 0 : 1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    serve(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
