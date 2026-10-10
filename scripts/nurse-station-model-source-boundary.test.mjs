import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { nurseStationSceneConfig, legacyNurseStationSceneConfig } from '../src/config/nurse-station-scene.ts';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelUrl = nurseStationSceneConfig.model.url;
const modelPath = new URL(`../public${modelUrl.split('?')[0]}`, import.meta.url);

assert.ok(config.includes(modelUrl));
assert.doesNotMatch(config, /\/models\/smart-ward-nurse-station\/1-1\.glb/);
assert.doesNotMatch(config, /\/models\/smart-ward-nurse-station\/1-v1/);
assert.doesNotMatch(config, /\/models\/smart-ward-nurse-station\/h-v1\.glb/);
assert.doesNotMatch(config, /nurse-station-design-v3\.glb/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 5_000_000 && model.length < 16 * 1024 * 1024, `unexpected nurse-station model size: ${model.length}`);

assert.equal(modelUrl, '/models/smart-ward-nurse-station/nurse-station-silver-v2.glb?v=20260929-refined');
await access(new URL(`../public${legacyNurseStationSceneConfig.model.url.split('?')[0]}`, import.meta.url));
console.log('Nurse-station model source boundary checks passed.');
