// @ts-check
import assert from 'node:assert/strict';
import test from 'node:test';
import { CHECKS, selectGroups, verify, commandInvocation } from '../../scripts/quality/verify.mjs';
import { e2eEnvironment } from '../../scripts/quality/serve-e2e.mjs';

test('default verification includes static, Rust, and real browser checks', () => {
  assert.deepEqual(selectGroups([]), ['static', 'rust', 'browser']);
  assert.deepEqual(selectGroups(['--quick']), ['static', 'rust']);
  assert.deepEqual(selectGroups(['--group', 'browser']), ['browser']);
});

test('unknown or injected command arguments are rejected', () => {
  for (const args of [
    ['--skip-tests'],
    ['--group', '__proto__'],
    ['--group', 'browser; echo unsafe'],
  ]) {
    assert.throws(() => selectGroups(args));
  }
});

test('independent groups keep running after a failed check', () => {
  /** @type {string[]} */
  const ran = [];
  const results = verify(['static', 'rust'], (check) => {
    ran.push(check.name);
    return check.name === 'TypeScript typecheck' ? 1 : 0;
  });
  assert.equal(results[0].status, 'failed');
  assert.ok(ran.includes('Rust unit, integration, and doc tests'));
  assert.equal(results.filter((result) => result.status === 'passed').length, results.length - 1);
});

test('a failed production build blocks downstream tests rather than inventing a pass', () => {
  let calls = 0;
  const results = verify(['browser'], () => {
    calls++;
    return 1;
  });
  assert.equal(calls, 1);
  assert.equal(results[0].status, 'failed');
  assert.ok(results.slice(1).every((result) => result.status === 'blocked'));
});

test('a network test failure does not prevent the independent E2E suite from running', () => {
  const results = verify(['browser'], (check) =>
    check.name === 'Live WebTransport integration' ? 1 : 0,
  );
  assert.equal(results[2].status, 'failed');
  assert.equal(results[3].status, 'passed');
});

test('missing executables and thrown runner errors are failures', () => {
  const results = verify(['rust'], () => {
    throw new Error('cargo unavailable');
  });
  assert.ok(results.every((result) => result.status === 'failed'));
});

test('Rust gates use locked resolution and warning-denying Clippy', () => {
  const clippy = CHECKS.rust.find((check) => check.args[0] === 'clippy');
  assert.ok(clippy?.args.includes('--locked'));
  assert.ok(clippy?.args.includes('--all-targets'));
  assert.deepEqual(clippy?.args.slice(-3), ['--', '-D', 'warnings']);
});

test('E2E environment cannot inherit keys, custom binaries, balance files, TLS, or public endpoints', () => {
  const env = e2eEnvironment(
    {
      PATH: 'keep-path',
      PORT: '1',
      HOST: '0.0.0.0',
      ECHO_ACCESS_KEY: 'private',
      ECHO_TLS_CERT: '/private/cert',
      ECHO_TLS_KEY: '/private/key',
      ECHO_SERVER_BIN: '/tmp/fake-server',
      ECHO_BALANCE_FILE: '/private/balance',
      ECHO_WT_PUBLIC_URL: 'https://public.example/echo',
      ECHO_PUBLIC_URL: 'https://public.example',
    },
    '/project',
  );
  assert.equal(env.PATH, 'keep-path');
  assert.equal(env.HOST, '127.0.0.1');
  assert.equal(env.PORT, '3107');
  assert.equal(env.ECHO_ACCESS_KEY, '');
  for (const key of ['ECHO_TLS_CERT', 'ECHO_TLS_KEY', 'ECHO_SERVER_BIN', 'ECHO_BALANCE_FILE']) {
    assert.equal(env[key], undefined);
  }
  assert.equal(env.ECHO_WT_PUBLIC_URL, '');
  assert.equal(env.ECHO_PUBLIC_URL, '');
});

test('formatting is a required static verification gate', () => {
  assert.ok(CHECKS.static.some((check) => check.args.includes('format:check')));
});

test('pnpm lifecycle invokes its JS entrypoint without a shell, including spaces', () => {
  const entry = 'C:/Program Files/pnpm/bin/pnpm.cjs';
  const invocation = commandInvocation(
    { name: 'test', command: 'pnpm', args: ['run', 'test:ts'] },
    'win32',
    { npm_execpath: entry },
  );
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args, [entry, 'run', 'test:ts']);
});

test('standalone Windows hooks use an explicit shell with constrained tokens', () => {
  const invocation = commandInvocation(
    { name: 'test', command: 'pnpm', args: ['run', 'typecheck'] },
    'win32',
    {},
  );
  assert.equal(invocation.command, 'cmd.exe');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'pnpm run typecheck']);
  for (const arg of ['foo & echo bad', '%TOKEN%', 'a b', '"quoted"', '!TOKEN!', 'a>b']) {
    assert.throws(() =>
      commandInvocation({ name: 'invalid', command: 'pnpm', args: ['run', arg] }, 'win32', {}),
    );
  }
});

test('native programs and POSIX pnpm keep argument arrays unchanged', () => {
  for (const [command, platform] of [
    ['cargo', 'win32'],
    ['pnpm', 'linux'],
  ]) {
    const check = { name: 'test', command, args: ['--version'] };
    const result = commandInvocation(check, /** @type {NodeJS.Platform} */ (platform), {});
    assert.equal(result.command, command);
    assert.deepEqual(result.args, check.args);
  }
});
