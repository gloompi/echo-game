#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @param {string} root @param {string[]} args @param {NodeJS.ProcessEnv} env @returns {string} */
function git(root, args, env) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `git ${args.join(' ')} failed.`);
  }
  return result.stdout.trim();
}

/** Ensure tests exercise exactly the commit contents, without stashing user work.
 * Fixture callers may supply an isolated environment. Real hooks retain Git's
 * exported repository/index variables by default.
 * @param {string} root @param {'pre-commit' | 'pre-push'} kind
 * @param {NodeJS.ProcessEnv} [env] @returns {string}
 */
export function checkedRevision(root, kind, env = process.env) {
  git(root, ['diff', '--quiet', '--ignore-submodules=none'], env);
  if (git(root, ['ls-files', '--others', '--exclude-standard'], env)) {
    throw new Error(
      'Untracked files are present. Stage or explicitly ignore them before verification.',
    );
  }
  if (kind === 'pre-push') {
    git(root, ['diff', '--cached', '--quiet'], env);
    return git(root, ['rev-parse', 'HEAD'], env);
  }
  return git(root, ['write-tree'], env);
}

/** @param {string} input @param {string} head @returns {void} */
export function validatePush(input, head) {
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error('Invalid pre-push ref input.');
    const localSha = fields[1];
    if (/^0+$/.test(localSha)) continue; // Deleting a remote ref does not publish code.
    if (localSha !== head) {
      throw new Error(
        'Check out the commit being pushed and verify it; this hook only verifies HEAD.',
      );
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const kind = process.argv[2];
    if (kind !== 'pre-commit' && kind !== 'pre-push')
      throw new Error('Expected pre-commit or pre-push.');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const before = checkedRevision(root, kind);
    if (kind === 'pre-push') validatePush(readFileSync(0, 'utf8'), before);
    const args = [joinVerification(root), ...(kind === 'pre-commit' ? ['--quick'] : [])];
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error || result.status !== 0)
      throw new Error('Verification failed; nothing was committed or pushed by this hook.');
    if (checkedRevision(root, kind) !== before)
      throw new Error('The index or HEAD changed during verification. Run the hook again.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      'Hooks require a fully staged working tree (pre-commit), or a clean HEAD (pre-push). No stash or reset was performed.',
    );
    process.exitCode = 1;
  }
}

/** @param {string} root */
function joinVerification(root) {
  return resolve(root, 'scripts/quality/verify.mjs');
}
