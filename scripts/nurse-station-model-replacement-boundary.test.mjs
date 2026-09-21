import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelPath = new URL('../public/models/smart-ward-nurse-station/nurse-station.glb', import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/nurse-station\.glb\?v=20260921['"]/);
assert.match(config, /layout: "legacy"/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 40_000_000 && model.length < 80_000_000, `unexpected nurse-station model size: ${model.length}`);

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
  '墙壁',
  '墙壁2',
  '走廊屏_1',
  '导台',
  'Station_Header',
])
  assert.ok(nodeNames.has(name), `missing required nurse-station node: ${name}`);

assert.equal(nodeNames.has('Screen_Work_01'), false, 'work screens are not part of this model contract');
assert.equal(nodeNames.has('Lobby_Back_Wall'), false);

for (const name of ['Monitor_Bezel', 'Screen_Glass', '门口机内', 'Warm_LED'])
  assert.ok(materialNames.has(name), `missing required nurse-station material: ${name}`);

console.log('Nurse-station model replacement boundary checks passed.');
