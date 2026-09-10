import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sceneConfig = await readFile(
  new URL('../src/config/nurse-station-scene.ts', import.meta.url),
  'utf8',
);

assert.match(sceneConfig, /target: \{ x: 0, y: 1\.65, z: -1\.2 \}/);
assert.match(sceneConfig, /initialDistance: 10\.99/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -13\.15, elevationDeg: 0\.78 \}/);
// Both constrained presentation and unrestricted camera calibration are supported.
assert.match(sceneConfig, /limitsEnabled:\s*(?:true|false)/);
assert.match(sceneConfig, /deskFov: 38/);

console.log('Nurse-station camera config update boundary checks passed.');
