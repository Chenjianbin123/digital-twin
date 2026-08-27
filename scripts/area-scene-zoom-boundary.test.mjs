import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const areaScene = readFileSync(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
const corridorControls = readFileSync(new URL('../src/core/area-corridor-controls.ts', import.meta.url), 'utf8');
const corridorConfig = readFileSync(new URL('../src/config/ward-corridor-scene.ts', import.meta.url), 'utf8');

test('病区走廊总览使用开放的缩放与旋转控制', () => {
  assert.match(areaScene, /resolveAreaCorridorControlLimits\(corridorLen\)/);
  assert.match(corridorControls, /wardCorridorSceneConfig\.controls/);
  assert.match(corridorConfig, /minDistance: 1\.2/);
  assert.match(corridorConfig, /minAzimuthAngle: -Infinity/);
  assert.match(corridorConfig, /maxAzimuthAngle: Infinity/);
});
