import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wardScene = await readFile(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('uses the current Three.js timer and shadow-map enum in the ward scene', () => {
  assert.match(wardScene, /private timer = new THREE\.Timer\(\)/);
  assert.doesNotMatch(wardScene, /new THREE\.Clock\(\)/);
  assert.match(wardScene, /THREE\.PCFShadowMap/);
  assert.doesNotMatch(wardScene, /THREE\.PCFSoftShadowMap/);
});
