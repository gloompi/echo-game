#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Install repository-local hooks without replacing a user's existing hook setup.
 * @param {string} root @param {NodeJS.ProcessEnv} env @returns {string}
 */
export function installHooks(root, env) {
  if (env.CI) return 'CI uses the quality-gate workflow; local hooks are not installed.';
  const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
  if (inside.status !== 0 || inside.stdout.trim() !== 'true')
    return 'Not a Git working tree; hooks were not installed.';
  const current = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
  if (current.error || (current.status !== 0 && current.status !== 1)) {
    throw new Error('Could not inspect the existing Git hooks configuration.');
  }
  const existing = current.stdout.trim();
  if (existing && existing !== '.githooks') {
    return `Preserved existing core.hooksPath=${existing}. Chain scripts/quality/hook.mjs from your hooks; see docs/engineering/verification.md.`;
  }
  const result = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    cwd: root,
    env,
  });
  if (result.error || result.status !== 0)
    throw new Error('Could not install repository-local hooks.');
  return 'Installed repository-local Echo hooks (.githooks).';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(
      installHooks(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), process.env),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
