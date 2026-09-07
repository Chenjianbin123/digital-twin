import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config/ward-interior-scene.ts', import.meta.url), 'utf8');
const bounds = readFileSync(new URL('../src/core/ward-interior-view-bounds.ts', import.meta.url), 'utf8');

test('ward interior viewBounds config uses 外壳 and 灯', () => {
  assert.match(config, /viewBounds:\s*\{/);
  assert.match(config, /shellMesh: '外壳'/);
  assert.match(config, /lightMesh: '灯'/);
});

test('ward interior view-bounds helpers capture and clamp named meshes', () => {
  assert.match(bounds, /captureWardInteriorBoundMeshes/);
  assert.match(bounds, /getWardInteriorPaddedBounds/);
  assert.match(bounds, /clampPointToWardInteriorBounds/);
});

test('WardScene clamps camera and target inside 外壳/灯 bounds', () => {
  assert.match(scene, /captureWardInteriorBoundMeshes\(model\)/);
  assert.match(scene, /applyWardInteriorViewBoundsConstraint/);
  assert.match(scene, /clampPointToWardInteriorBounds\(this\.controls\.target/);
  assert.match(scene, /clampPointToWardInteriorBounds\(this\.camera\.position/);
});
