import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../src/config/ward-interior-scene.ts', import.meta.url), 'utf8');
const wardScene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const modelGuide = readFileSync(new URL('../docs/model-guides/ward-interior-model-configuration.md', import.meta.url), 'utf8');

test('declares a seven-bed modular ward capacity', () => {
  assert.match(config, /maxBeds:\s*7/);
  assert.match(modelGuide, /一至七张床/);
});

test('caps the runtime bed list before cloning prototype modules', () => {
  assert.match(wardScene, /const WARD_INTERIOR_MAX_BEDS = wardInteriorSceneConfig\.modelBedLayout\.maxBeds;/);
  assert.match(wardScene, /const dynamicBeds = ward\.beds\.slice\(0, WARD_INTERIOR_MAX_BEDS\);/);
  assert.match(wardScene, /this\.createBedMesh\(bed, index, dynamicBeds\.length\)/);
});

test('does not silently drop beds above the baked source model count', () => {
  const start = wardScene.indexOf('  private createBedMesh(');
  const end = wardScene.indexOf('  private createGeneratedBedMesh(', start);
  const createBedMesh = wardScene.slice(start, end);

  assert.doesNotMatch(createBedMesh, /index < this\.wardInteriorParts\.bakedBeds\.length/);
});
