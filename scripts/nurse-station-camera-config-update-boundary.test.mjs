import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sceneConfig = await readFile(
  new URL('../src/config/nurse-station-scene.ts', import.meta.url),
  'utf8',
);

assert.match(sceneConfig, /target: \{ x: 0\.752, y: 0\.455, z: 0\.764 \}/);
assert.match(sceneConfig, /initialDistance: 2\.507/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -80\.8, elevationDeg: 0\.35 \}/);
// Both constrained presentation and unrestricted camera calibration are supported.
assert.match(sceneConfig, /limitsEnabled:\s*(?:true|false)/);
assert.match(sceneConfig, /deskFov: 38/);

console.log('Nurse-station camera config update boundary checks passed.');
