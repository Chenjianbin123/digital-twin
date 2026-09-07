import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sceneConfig = await readFile(
  new URL('../src/config/nurse-station-scene.ts', import.meta.url),
  'utf8',
);

assert.match(sceneConfig, /target: \{ x: 0\.42, y: 0\.812, z: 0\.257 \}/);
assert.match(sceneConfig, /initialDistance: 3\.523/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -88\.3, elevationDeg: 4\.56 \}/);
assert.match(sceneConfig, /limitsEnabled:\s*true/);
assert.match(sceneConfig, /deskFov: 30/);

console.log('Nurse-station camera config update boundary checks passed.');
