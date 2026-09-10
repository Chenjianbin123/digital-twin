import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelUrl = '/models/smart-ward-nurse-station/nurse-station-design-v2.glb?v=20260909';
const modelPath = new URL('../public/models/smart-ward-nurse-station/nurse-station-design-v2.glb', import.meta.url);

assert.ok(config.includes(modelUrl));
assert.doesNotMatch(config, /\/models\/smart-ward-nurse-station\/1-v1\.glb/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 20_000_000 && model.length < 35_000_000, `unexpected reference model size: ${model.length}`);
const source = await readFile(new URL('../output/nurse-station-reference-v2/nurse-station-design-v2.glb', import.meta.url));
assert.ok(model.equals(source), 'production asset must match the approved v2 source');
await access(new URL('../public/models/smart-ward-nurse-station/1-1.glb', import.meta.url));

assert.equal(modelUrl, '/models/smart-ward-nurse-station/nurse-station-design-v2.glb?v=20260909');
console.log('Nurse-station model source boundary checks passed.');
