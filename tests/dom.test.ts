// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElementLookup, setText } from '../client/ui/dom.js';

void test('missing required DOM elements produce actionable startup errors', () => {
  const element = createElementLookup({ getElementById: () => null });
  assert.throws(() => element('game'), /#game is missing/);
});
void test('unchanged UI text does not cause another DOM write', () => {
  let content = 'Ready',
    writes = 0;
  const element = {
    get textContent() {
      return content;
    },
    set textContent(value: string) {
      writes++;
      content = value;
    },
  };
  setText(element, 'Ready');
  assert.equal(writes, 0);
  setText(element, 'Playing');
  assert.equal(writes, 1);
  setText(element, 'Playing');
  assert.equal(writes, 1);
  assert.equal(content, 'Playing');
});
