import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentUrl = new URL('../src/components/NurseStationVisualScene.vue', import.meta.url);

test('nurse station scene stays centered without fixed offsets or pointer motion', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.match(source, /&__scene\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/);
  assert.doesNotMatch(source, /--station-base-x/);
  assert.doesNotMatch(source, /--station-shift-[xy]/);
  assert.doesNotMatch(source, /handlePointerMove/);
  assert.doesNotMatch(source, /pointermove/);
});
