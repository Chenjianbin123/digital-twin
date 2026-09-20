import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /preloadBedTemplates/);

const snapshotBody = source.slice(
  source.indexOf('async function fetchAreaSnapshot'),
  source.indexOf('async function commitRequestedArea'),
);
assert.match(snapshotBody, /await measureLoadStage\('bed-details', \(\) => loadBedDeviceDetails/);
assert.doesNotMatch(snapshotBody, /preloadBedTemplates/);

const loadAreaBody = source.slice(
  source.indexOf('async function loadArea(options'),
  source.indexOf('function updateBedStatus'),
);
assert.match(loadAreaBody, /await loadBedDeviceDetails/);
assert.doesNotMatch(loadAreaBody, /preloadBedTemplates/);
const doorApi = readFileSync(new URL('../src/api/door-device.ts', import.meta.url), 'utf8');
assert.doesNotMatch(doorApi, /preloadDoorTemplates|loadTemplateInfo/);
const scene = readFileSync(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
assert.match(scene, /private async refreshDoorScreen[\s\S]{0,180}this.modelKind === 'station'/);
for (const file of ['ward-scene.ts', 'ward-corridor-screens.ts']) {
  assert.match(readFileSync(new URL(`../src/core/${file}`, import.meta.url), 'utf8'), /await loadParsedTemplate/);
}
