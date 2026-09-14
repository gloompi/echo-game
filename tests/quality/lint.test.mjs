// @ts-check
import assert from 'node:assert/strict';
import test from 'node:test';
import { importViolation, lintSource } from '../../scripts/quality/lint.mjs';

test('production imports may only point inward', () => {
  for (const [file, specifier] of [
    ['shared/state.ts', '../client/main.js'], ['shared/state.ts', 'three'],
    ['client/network/state.ts', '../../tests/helper.js'], ['client/main.ts', 'node:fs'],
    ['client/main.ts', 'fs'], ['client/main.ts', '../scripts/play.mjs'],
    ['client/main.ts', '/tmp/module.js'], ['shared/state.ts', '../../shared/outside.js'],
  ]) assert.ok(importViolation(file, specifier), `${file}: ${specifier}`);
});

test('declared runtime and domain dependencies remain allowed', () => {
  for (const [file, specifier] of [
    ['client/main.ts', 'three'], ['client/main.ts', 'three/addons/loaders/GLTFLoader.js'],
    ['client/network/state.ts', '../../shared/types.js'], ['shared/state.ts', './types.js'],
    ['client/main.ts', './style.css'], ['tests/game.test.ts', '../client/main.js'],
  ]) assert.equal(importViolation(file, specifier), undefined);
});

test('imports, re-exports, dynamic imports, and type imports share the boundary policy', () => {
  const source = `import x from '../client/x.js';
    export { y } from '../client/y.js';
    const z = import('../client/z.js');
    type T = import('../client/t.js').T;
    const q = require('../client/q.js');`;
  assert.equal(lintSource('shared/invalid.ts', source).filter(v => v.rule === 'architecture').length, 5);
});

test('nonliteral dynamic imports cannot hide production dependencies', () => {
  assert.equal(lintSource('client/dynamic.ts', 'import(modulePath);')[0]?.rule, 'architecture');
  assert.deepEqual(lintSource('tests/dynamic.test.ts', 'import(modulePath);'), []);
});

test('unsafe syntax is flagged without confusing strings for code', () => {
  const rules = lintSource('scripts/bad.mjs', 'var x = 1; debugger; eval(x); new Function(x);').map(v => v.rule);
  assert.deepEqual(rules, ['no-var', 'no-debugger', 'no-dynamic-code', 'no-dynamic-code']);
  assert.deepEqual(lintSource('scripts/good.mjs', "const example = 'var x = 1; debugger;';"), []);
});

test('typecheck bypasses are found only in real comment tokens', () => {
  assert.equal(lintSource('client/bad.ts', '// @ts-nocheck\nconst x = 1;')[0]?.rule, 'no-typecheck-bypass');
  assert.deepEqual(lintSource('tests/good.test.ts', "const example = '// @ts-ignore';"), []);
});
