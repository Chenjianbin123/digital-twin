import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../src/config/ward-interior-scene.ts', import.meta.url), 'utf8');
const wardScene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/components/workspace/DigitalTwinWorkspace.vue', import.meta.url), 'utf8');
const modelGuide = readFileSync(new URL('../docs/model-guides/ward-interior-model-configuration.md', import.meta.url), 'utf8');

test('documents native double room and expanded original room', () => {
  assert.match(config, /maxBeds:\s*7/);
  assert.match(modelGuide, /固定双床房/);
  assert.match(modelGuide, /保留原病房/);
});

test('does not truncate physical beds in the modular path', () => {
  assert.match(wardScene, /const WARD_INTERIOR_MAX_BEDS = wardInteriorSceneConfig\.modelBedLayout\.maxBeds;/);
  assert.match(wardScene, /\? selectWardBeds\(ward\)\.beds\s*:/m);
  assert.doesNotMatch(wardScene, /selectWardBeds\(ward\)\.beds\.slice/);
  assert.match(wardScene, /this\.createBedMesh\(bed, index, dynamicBeds\.length\)/);
  assert.match(workspace, /beds: selectWardBeds\(currentWard\.value\)\.beds/);
});

test('does not silently drop beds above the baked source model count', () => {
  const start = wardScene.indexOf('  private createBedMesh(');
  const end = wardScene.indexOf('  private createGeneratedBedMesh(', start);
  const createBedMesh = wardScene.slice(start, end);

  assert.doesNotMatch(createBedMesh, /index < this\.wardInteriorParts\.bakedBeds\.length/);
});
