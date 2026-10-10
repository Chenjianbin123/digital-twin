import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { nurseStationSceneConfig } from '../src/config/nurse-station-scene.ts';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelPath = new URL(`../public${nurseStationSceneConfig.model.url.split('?')[0]}`, import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/nurse-station\.glb\?v=20260921['"]/);
assert.equal(nurseStationSceneConfig.model.layout, 'silver-v1');

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length < 16 * 1024 * 1024, `unexpected nurse-station model size: ${model.length}`);

const jsonLength = model.readUInt32LE(12);
const jsonType = model.readUInt32LE(16);
assert.equal(jsonType, 0x4e4f534a);
const json = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8').trim());
const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
const materialNames = new Set((json.materials ?? []).map(material => material.name).filter(Boolean));

for (const name of [
  'Screen_Main_Frame',
  'Screen_Main',
  'Clock_Display',
  'Ceiling',
  '地板',
  'NurseStationSilverV1',
  'Screen_Video',
  'TV_Wall_Mount',
  'Screen_Service',
  'Screen_Work_01',
  'Screen_Work_02',
  'Screen_Work_03',
  'Screen_Work_04',
])
  assert.ok(nodeNames.has(name), `missing required nurse-station node: ${name}`);

assert.ok(![...nodeNames].some(name => name.startsWith('Preview_')), 'No baked synthetic business data');

for (const name of ['SilverV1_silver_AO', 'SilverV1_white_AO', 'SilverV1_cyan_AO', 'SilverV1_screen'])
  assert.ok(materialNames.has(name), `missing required nurse-station material: ${name}`);

console.log('Nurse-station model replacement boundary checks passed.');
