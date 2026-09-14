#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @typedef {'static' | 'rust' | 'browser'} Group */
/** @typedef {{ name: string, command: string, args: string[], prerequisite?: boolean }} Check */
/** @typedef {{ name: string, status: 'passed' | 'failed' | 'blocked', code: number }} Result */

/** @type {Record<Group, Check[]>} */
export const CHECKS = {
  static: [
    { name: 'TypeScript typecheck', command: 'pnpm', args: ['run', 'typecheck'] },
    { name: 'Quality-tooling typecheck', command: 'pnpm', args: ['run', 'typecheck:tools'] },
    { name: 'JavaScript/TypeScript lint and boundaries', command: 'pnpm', args: ['run', 'lint:ts'] },
    { name: 'Verification and hook tests', command: 'pnpm', args: ['run', 'test:tools'] },
    { name: 'TypeScript unit tests', command: 'pnpm', args: ['run', 'test:ts'] },
    { name: 'Generated map and parity fixtures', command: 'pnpm', args: ['run', 'fixtures:check'] },
    { name: 'Launcher integration', command: 'pnpm', args: ['run', 'test:launcher'] },
  ],
  rust: [
    { name: 'Rust formatting', command: 'cargo', args: ['fmt', '--all', '--', '--check'] },
    { name: 'Rust lint', command: 'cargo', args: ['clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings'] },
    { name: 'Rust unit, integration, and doc tests', command: 'cargo', args: ['test', '--workspace', '--locked'] },
  ],
  browser: [
    { name: 'Production client build', command: 'pnpm', args: ['run', 'build:client'], prerequisite: true },
    { name: 'Production server build', command: 'cargo', args: ['build', '--release', '--locked', '-p', 'echo-server'], prerequisite: true },
    { name: 'Live WebTransport integration', command: 'pnpm', args: ['run', 'test:network'] },
    { name: 'Real application E2E', command: 'pnpm', args: ['run', 'test:e2e:built'] },
  ],
};

/** @param {string[]} args @returns {Group[]} */
export function selectGroups(args) {
  if (args.length === 0) return ['static', 'rust', 'browser'];
  if (args.length === 1 && args[0] === '--quick') return ['static', 'rust'];
  if (args.length === 2 && args[0] === '--group' && Object.hasOwn(CHECKS, args[1])) {
    return [/** @type {Group} */ (args[1])];
  }
  throw new Error('Usage: verify.mjs [--quick | --group static|rust|browser]');
}

/** Continue independent checks; never count an unexecuted dependent test as passing.
 * @param {Group[]} groups @param {(check: Check) => number} run @returns {Result[]}
 */
export function verify(groups, run) {
  /** @type {Result[]} */
  const results = [];
  for (const group of groups) {
    let blocked = false;
    for (const check of CHECKS[group]) {
      if (blocked) {
        results.push({ name: check.name, status: 'blocked', code: 1 });
        continue;
      }
      let code;
      try { code = run(check); } catch { code = 1; }
      results.push({ name: check.name, status: code === 0 ? 'passed' : 'failed', code });
      if (code !== 0 && check.prerequisite) blocked = true;
    }
  }
  return results;
}

/** @param {Check} check @param {string} root @returns {number} */
function runCommand(check, root) {
  console.log(`\n=== ${check.name} ===\n> ${check.command} ${check.args.join(' ')}`);
  const result = spawnSync(check.command, check.args, {
    cwd: root, stdio: 'inherit',
    // Windows package-manager shims are cmd files. Arguments here are fixed,
    // reviewed commands, never branch names, filenames, or arbitrary CLI input.
    shell: process.platform === 'win32' && check.command === 'pnpm',
  });
  if (result.error) console.error(result.error.message);
  if (result.signal) console.error(`Terminated by ${result.signal}.`);
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const groups = selectGroups(process.argv.slice(2));
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const results = verify(groups, check => runCommand(check, root));
    console.log('\nVerification results:');
    for (const result of results) console.log(`${result.status.toUpperCase()}: ${result.name}`);
    process.exitCode = results.every(result => result.status === 'passed') ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
