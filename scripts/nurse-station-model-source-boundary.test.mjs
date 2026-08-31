import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelUrl = '/models/smart-ward-nurse-station/1-1.glb?v=20260831-nurse-station-1-1';
const modelPath = new URL('../public/models/smart-ward-nurse-station/1-1.glb', import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/1-1\.glb\?v=20260831-nurse-station-1-1['"]/);
assert.doesNotMatch(config, /\/models\/smart-ward-nurse-station\/1-v1\.glb/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 60_000_000, `expected 1-1.glb to be the supplied high-detail model, got ${model.length} bytes`);

assert.equal(modelUrl, '/models/smart-ward-nurse-station/1-1.glb?v=20260831-nurse-station-1-1');
console.log('Nurse-station model source boundary checks passed.');
