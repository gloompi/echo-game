#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Expand filenames in Node, not the shell: Windows cmd does not expand globs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = join(root, 'tests/quality');
const tests = readdirSync(directory).filter(name => name.endsWith('.test.mjs')).sort();
if (tests.length === 0) throw new Error('No quality-tool tests found.');
const result = spawnSync(process.execPath, ['--test', ...tests.map(name => join(directory, name))], {
  cwd: root, stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
