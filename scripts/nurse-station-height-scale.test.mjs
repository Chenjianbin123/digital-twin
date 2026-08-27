import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sceneUrl = new URL('../src/core/area-scene.ts', import.meta.url);
const configUrl = new URL('../src/config/nurse-station-scene.ts', import.meta.url);

test('nurse station GLB keeps sign text proportions while using a taller camera framing', async () => {
  const source = await readFile(sceneUrl, 'utf8');
  const config = await readFile(configUrl, 'utf8');

  assert.doesNotMatch(source, /NURSE_STATION_MODEL_HEIGHT_SCALE/);
  assert.doesNotMatch(source, /model\.scale\.y\s*\*=/);
  assert.match(config, /target: \{ x: -?\d+(?:\.\d+)?, y: -?\d+(?:\.\d+)?, z: -?\d+(?:\.\d+)? \}/);
  assert.match(config, /initialDistance: \d+(?:\.\d+)?/);
  assert.match(config, /initialAngle: \{ azimuthDeg: -?\d+(?:\.\d+)?, elevationDeg: -?\d+(?:\.\d+)? \}/);
});
