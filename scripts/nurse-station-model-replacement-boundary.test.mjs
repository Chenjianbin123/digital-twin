import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelPath = new URL('../public/models/smart-ward-nurse-station/1-1.glb', import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/1-1\.glb\?v=20260901-h-n2-v1['"]/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 50_000_000, `expected h-n2-v1.glb to be the supplied high-detail model, got ${model.length} bytes`);

const jsonLength = model.readUInt32LE(12);
const jsonType = model.readUInt32LE(16);
assert.equal(jsonType, 0x4e4f534a);
const json = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8').trim());
const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
const materialNames = new Set((json.materials ?? []).map(material => material.name).filter(Boolean));

for (const name of [
  'Screen_Main_Frame',
  'Clock_Frame',
  'Workstation_01',
  'Workstation_02',
  'Workstation_03',
  'Workstation_04',
  'Keyboard_01',
  'Keyboard_02',
  'Keyboard_03',
  'Keyboard_04',
  '走廊屏_1',
])
  assert.ok(nodeNames.has(name), `missing required nurse-station node: ${name}`);

for (const name of ['Monitor_Bezel', 'Screen_Glass', 'UI_Blue', 'UI_Cyan', 'Clock_Red'])
  assert.ok(materialNames.has(name), `missing required nurse-station material: ${name}`);

console.log('Nurse-station model replacement boundary checks passed.');
