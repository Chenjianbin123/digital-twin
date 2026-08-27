import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentUrl = new URL('../src/components/NurseStationVisualScene.vue', import.meta.url);

test('nurse station does not render room status markers', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.doesNotMatch(source, /aria-label="重点病房"/);
  assert.doesNotMatch(source, /class="room-marker"/);
  assert.doesNotMatch(source, /selectNurseStationMarkers/);
});
