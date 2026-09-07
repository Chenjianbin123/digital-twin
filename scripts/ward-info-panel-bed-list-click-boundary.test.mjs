import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8');

test('ward info panel exposes clickable bed entries for selection', () => {
  assert.match(source, /defineEmits<\{/);
  assert.match(source, /bedClick:/);
  assert.match(source, /@click="emit\('bedClick', bed\)"/);
  assert.match(source, /type="button"/);
});
