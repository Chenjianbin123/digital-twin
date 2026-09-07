import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const areaScene = readFileSync(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config/ward-corridor-scene.ts', import.meta.url), 'utf8');
const camera = readFileSync(new URL('../src/core/ward-corridor-camera.ts', import.meta.url), 'utf8');

test('corridor viewBounds config uses named floor / walls / ceiling meshes', () => {
  assert.match(config, /viewBounds:\s*\{/);
  assert.match(config, /floorMesh: '地板'/);
  assert.match(config, /ceilingMesh: '天花板'/);
  assert.match(config, /wallMeshes: \['墙壁', '墙壁2'\]/);
});

test('corridor camera helpers capture and clamp against named meshes', () => {
  assert.match(camera, /captureWardCorridorBoundMeshes/);
  assert.match(camera, /getWardCorridorPaddedBounds/);
  assert.match(camera, /clampPointToWardCorridorBounds/);
});

test('AreaScene clamps corridor camera and target inside mesh bounds', () => {
  assert.match(areaScene, /captureWardCorridorBoundMeshes\(model\)/);
  assert.match(areaScene, /applyCorridorViewBoundsConstraint/);
  assert.match(areaScene, /clampPointToWardCorridorBounds\(this\.controls\.target/);
  assert.match(areaScene, /clampPointToWardCorridorBounds\(this\.camera\.position/);
});
