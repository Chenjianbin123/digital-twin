import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelPath = new URL('../public/models/smart-ward-nurse-station/nurse-station-design-v2.glb', import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/nurse-station-design-v2\.glb\?v=20260909['"]/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 20_000_000 && model.length < 35_000_000, `unexpected reference model size: ${model.length}`);

const jsonLength = model.readUInt32LE(12);
const jsonType = model.readUInt32LE(16);
assert.equal(jsonType, 0x4e4f534a);
const json = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8').trim());
const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
const materialNames = new Set((json.materials ?? []).map(material => material.name).filter(Boolean));

for (const name of [
  'Screen_Main_Frame',
  'Clock_Frame',
  'Screen_Main',
  'Screen_Work_01',
  'Screen_Work_02',
  'Screen_Work_03',
  'Screen_Work_04',
  'Clock_Display',
  'Keyboard_01',
  'Keyboard_02',
  'Keyboard_03',
  'Keyboard_04',
  'Staff_Worktop',
  'Ceiling',
])
  assert.ok(nodeNames.has(name), `missing required nurse-station node: ${name}`);

for (const name of ['Monitor_Bezel', 'Screen_Glass', 'Natural_Oak', 'Warm_White_Solid_Surface'])
  assert.ok(materialNames.has(name), `missing required nurse-station material: ${name}`);

console.log('Nurse-station model replacement boundary checks passed.');
