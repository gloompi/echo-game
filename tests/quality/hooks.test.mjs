// @ts-check
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkedRevision, validatePush } from '../../scripts/quality/hook.mjs';
import { installHooks } from '../../scripts/quality/install-hooks.mjs';

const env = { ...process.env, CI: '', GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_TEMPLATE_DIR: '' };

/** @param {import('node:test').TestContext} context */
function repository(context) {
  const root = mkdtempSync(join(tmpdir(), 'echo-hook-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  /** @param {string[]} args */
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  writeFileSync(join(root, 'game.txt'), 'first\n');
  git('add', 'game.txt');
  return { root, git };
}

test('pre-commit rejects partially staged work without changing it', context => {
  const { root } = repository(context);
  assert.match(checkedRevision(root, 'pre-commit'), /^[a-f0-9]+$/);
  writeFileSync(join(root, 'game.txt'), 'unstaged\n');
  assert.throws(() => checkedRevision(root, 'pre-commit'));
});

test('untracked files cannot accidentally contribute to a verified staged commit', context => {
  const { root } = repository(context);
  writeFileSync(join(root, 'untracked.txt'), 'not staged\n');
  assert.throws(() => checkedRevision(root, 'pre-commit'), /Untracked files/);
});

test('staging a new tree changes the verification identity', context => {
  const { root, git } = repository(context);
  const first = checkedRevision(root, 'pre-commit');
  writeFileSync(join(root, 'game.txt'), 'second\n');
  git('add', 'game.txt');
  assert.notEqual(checkedRevision(root, 'pre-commit'), first);
});

test('pre-push requires the committed clean HEAD, not merely a staged tree', context => {
  const { root, git } = repository(context);
  git('-c', 'user.name=Quality Test', '-c', 'user.email=quality@example.invalid', 'commit', '--quiet', '-m', 'fixture');
  const head = checkedRevision(root, 'pre-push');
  assert.equal(head, git('rev-parse', 'HEAD'));
  writeFileSync(join(root, 'game.txt'), 'staged but not committed\n');
  git('add', 'game.txt');
  assert.throws(() => checkedRevision(root, 'pre-push'));
});

test('pushes of another commit cannot borrow the current checkout test result', () => {
  const head = 'a'.repeat(40);
  validatePush(`refs/heads/main ${head} refs/heads/main ${'b'.repeat(40)}\n`, head);
  validatePush(`(delete) ${'0'.repeat(40)} refs/heads/old ${'b'.repeat(40)}\n`, head);
  assert.throws(() => validatePush(`refs/heads/other ${'b'.repeat(40)} refs/heads/other ${head}`, head));
  assert.throws(() => validatePush('malformed', head));
});

test('hook installation is repository-local', context => {
  const { root, git } = repository(context);
  assert.match(installHooks(root, env), /Installed repository-local/);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.githooks');
});

test('existing custom hooks are preserved instead of silently replaced', context => {
  const { root, git } = repository(context);
  git('config', '--local', 'core.hooksPath', 'custom-hooks');
  assert.match(installHooks(root, env), /Preserved existing/);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), 'custom-hooks');
});

test('CI does not modify local hook configuration', context => {
  const { root } = repository(context);
  assert.match(installHooks(root, { ...env, CI: 'true' }), /not installed/);
  assert.equal(spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: root, env }).status, 1);
});
