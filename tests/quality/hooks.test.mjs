// @ts-check
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkedRevision, validatePush } from '../../scripts/quality/hook.mjs';
import { installHooks } from '../../scripts/quality/install-hooks.mjs';

/** @param {import('node:test').TestContext} context @param {NodeJS.ProcessEnv} [inherited] */
function repository(context, inherited = process.env) {
  // Spaces exercise argument/path handling on both Windows and POSIX.
  const scratch = mkdtempSync(join(tmpdir(), 'echo hook test-'));
  context.after(() =>
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  );
  const root = join(scratch, 'repository');
  const globalConfig = join(scratch, 'empty.gitconfig');
  const templates = join(scratch, 'templates');
  mkdirSync(root);
  mkdirSync(templates);
  // Git for Windows cannot read Node's \\.\nul as a configuration file.
  // Keep a real empty file OUTSIDE the worktree, or untracked-file checks fail.
  writeFileSync(globalConfig, '');
  // Hooks export repository/index/config variables. Clear them only for these
  // foreign fixture repositories, never for the real hook's caller environment.
  const env = {
    ...Object.fromEntries(Object.entries(inherited).filter(([key]) => !/^(GIT_|CI$)/i.test(key))),
    CI: '',
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TEMPLATE_DIR: templates,
  };
  /** @param {string[]} args */
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  writeFileSync(join(root, 'game.txt'), 'first\n');
  git('add', 'game.txt');
  /** @param {'pre-commit' | 'pre-push'} kind */
  const revision = (kind) => checkedRevision(root, kind, env);
  return { root, git, env, revision };
}

test('pre-commit rejects partially staged work without changing it', (context) => {
  const { root, revision } = repository(context);
  assert.match(revision('pre-commit'), /^[a-f0-9]+$/);
  writeFileSync(join(root, 'game.txt'), 'unstaged\n');
  assert.throws(() => revision('pre-commit'));
  assert.equal(readFileSync(join(root, 'game.txt'), 'utf8'), 'unstaged\n');
});

test('untracked files cannot accidentally contribute to a verified staged commit', (context) => {
  const { root, revision } = repository(context);
  writeFileSync(join(root, 'untracked.txt'), 'not staged\n');
  assert.throws(() => revision('pre-commit'), /Untracked files/);
});

test('staging a new tree changes the verification identity', (context) => {
  const { root, git, revision } = repository(context);
  const first = revision('pre-commit');
  writeFileSync(join(root, 'game.txt'), 'second\n');
  git('add', 'game.txt');
  assert.notEqual(revision('pre-commit'), first);
});

test('pre-push requires the committed clean HEAD, not merely a staged tree', (context) => {
  const { root, git, revision } = repository(context);
  git(
    '-c',
    'user.name=Quality Test',
    '-c',
    'user.email=quality@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  );
  const head = revision('pre-push');
  assert.equal(head, git('rev-parse', 'HEAD'));
  writeFileSync(join(root, 'game.txt'), 'staged but not committed\n');
  git('add', 'game.txt');
  assert.throws(() => revision('pre-push'));
});

test('pushes of another commit cannot borrow the current checkout test result', () => {
  const head = 'a'.repeat(40);
  validatePush(`refs/heads/main ${head} refs/heads/main ${'b'.repeat(40)}\n`, head);
  validatePush(`(delete) ${'0'.repeat(40)} refs/heads/old ${'b'.repeat(40)}\n`, head);
  assert.throws(() =>
    validatePush(`refs/heads/other ${'b'.repeat(40)} refs/heads/other ${head}`, head),
  );
  assert.throws(() => validatePush('malformed', head));
});

test('hook installation is repository-local', (context) => {
  const { root, git, env } = repository(context);
  assert.match(installHooks(root, env), /Installed repository-local/);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.githooks');
});

test('existing custom hooks are preserved instead of silently replaced', (context) => {
  const { root, git, env } = repository(context);
  git('config', '--local', 'core.hooksPath', 'custom-hooks');
  assert.match(installHooks(root, env), /Preserved existing/);
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), 'custom-hooks');
});

test('CI does not modify local hook configuration', (context) => {
  const { root, env } = repository(context);
  assert.match(installHooks(root, { ...env, CI: 'true' }), /not installed/);
  assert.equal(
    spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: root, env }).status,
    1,
  );
});

test('fixture Git config is a real empty file outside the checked worktree', (context) => {
  const { root, git, env, revision } = repository(context);
  assert.equal(statSync(env.GIT_CONFIG_GLOBAL).isFile(), true);
  assert.equal(readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8'), '');
  assert.equal(dirname(env.GIT_CONFIG_GLOBAL), dirname(root));
  assert.equal(git('config', '--global', '--list'), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard'), '');
  assert.equal(revision('pre-commit'), git('write-tree'));
});

test('fixture commands cannot inherit the caller repository, index, or config overrides', (context) => {
  const foreign = repository(context);
  const indexPath = join(foreign.root, '.git', 'index');
  const indexBefore = readFileSync(indexPath);
  const configPath = join(foreign.root, '.git', 'config');
  const configBefore = readFileSync(configPath);
  const inherited = {
    ...process.env,
    GIT_DIR: join(foreign.root, '.git'),
    GIT_WORK_TREE: foreign.root,
    GIT_INDEX_FILE: indexPath,
    GIT_CONFIG_GLOBAL: '\\\\.\\nul',
    GIT_CONFIG: configPath,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.bare',
    GIT_CONFIG_VALUE_0: 'true',
    git_config_parameters: "'core.bare=true'",
    CI: 'true',
    ci: 'true',
  };
  const saved = { ...inherited };
  const { root, git, env, revision } = repository(context, inherited);
  assert.deepEqual(inherited, saved);
  assert.equal(env.CI, '');
  for (const key of Object.keys(inherited).filter((key) => /^(GIT_|CI$)/i.test(key))) {
    if (
      key !== 'CI' &&
      key !== 'GIT_CONFIG_GLOBAL' &&
      key !== 'GIT_CONFIG_NOSYSTEM' &&
      key !== 'GIT_TEMPLATE_DIR'
    ) {
      assert.equal(Object.hasOwn(env, key), false, key);
    }
  }
  assert.equal(revision('pre-commit'), git('write-tree'));
  assert.match(installHooks(root, env), /Installed repository-local/);
  assert.deepEqual(readFileSync(indexPath), indexBefore);
  assert.deepEqual(readFileSync(configPath), configBefore);
});

test('checkedRevision uses the supplied environment for every Git subprocess', (context) => {
  const { root, git, env } = repository(context);
  git(
    '-c',
    'user.name=Quality Test',
    '-c',
    'user.email=quality@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  );
  const hookUrl = new URL('../../scripts/quality/hook.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
    import { checkedRevision } from ${JSON.stringify(hookUrl)};
    import { readFileSync } from 'node:fs';
    const root = process.argv[1];
    const env = JSON.parse(readFileSync(0, 'utf8'));
    console.log(checkedRevision(root, 'pre-commit', env));
    console.log(checkedRevision(root, 'pre-push', env));
  `,
      root,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify(env),
      env: { ...env, GIT_DIR: join(root, 'missing.git'), GIT_CONFIG_GLOBAL: root },
    },
  );
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
    git('write-tree'),
    git('rev-parse', 'HEAD'),
  ]);
});

test('real hook callers still inherit their explicitly selected Git index by default', (context) => {
  const { root, git, env } = repository(context);
  const originalTree = git('write-tree');
  const alternateIndex = join(dirname(root), 'alternate.index');
  copyFileSync(join(root, '.git', 'index'), alternateIndex);
  writeFileSync(join(root, 'game.txt'), 'staged in alternate index\n');
  const alternateEnv = { ...env, GIT_INDEX_FILE: alternateIndex };
  const added = spawnSync('git', ['add', 'game.txt'], {
    cwd: root,
    env: alternateEnv,
    encoding: 'utf8',
  });
  assert.equal(added.status, 0, added.error?.message || added.stderr);
  const expectedTree = checkedRevision(root, 'pre-commit', alternateEnv);
  assert.notEqual(expectedTree, originalTree);
  const hookUrl = new URL('../../scripts/quality/hook.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
    import { checkedRevision } from ${JSON.stringify(hookUrl)};
    console.log(checkedRevision(process.argv[1], 'pre-commit'));
  `,
      root,
    ],
    { cwd: root, env: alternateEnv, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  assert.equal(result.stdout.trim(), expectedTree);
  assert.equal(git('write-tree'), originalTree);
});
