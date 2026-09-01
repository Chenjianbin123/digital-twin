import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sceneConfig = await readFile(
  new URL('../src/config/nurse-station-scene.ts', import.meta.url),
  'utf8',
);

assert.match(sceneConfig, /target: \{ x: 1\.068, y: 0\.807, z: 0\.369 \}/);
assert.match(sceneConfig, /initialDistance: 5\.726/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -82\.69, elevationDeg: 2\.2 \}/);
assert.match(sceneConfig, /limitsEnabled:\s*true/);
assert.match(sceneConfig, /deskFov: 30/);

console.log('Nurse-station camera config update boundary checks passed.');
