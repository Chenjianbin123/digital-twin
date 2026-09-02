import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
assert.match(source, /preloadBedTemplates/);

const snapshotBody = source.slice(
  source.indexOf('async function fetchAreaSnapshot'),
  source.indexOf('async function commitRequestedArea'),
);
assert.match(snapshotBody, /loadBedDeviceDetails[\s\S]*preloadBedTemplates/);

const loadAreaBody = source.slice(
  source.indexOf('async function loadArea(options'),
  source.indexOf('function updateBedStatus'),
);
assert.match(loadAreaBody, /loadBedDeviceDetails[\s\S]*preloadBedTemplates/);
const warningAssignment = loadAreaBody.indexOf('dataWarnings.value = warnings');
const bedPreload = loadAreaBody.indexOf('preloadBedTemplates');
assert.ok(warningAssignment > bedPreload, 'bed preload warnings should be committed after bed loading');
