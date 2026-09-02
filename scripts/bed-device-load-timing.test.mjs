import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

const snapshotBody = source.slice(
  source.indexOf('async function fetchAreaSnapshot'),
  source.indexOf('async function commitRequestedArea'),
);
assert.match(snapshotBody, /loadBedDeviceDetails/);

const loadAreaBody = source.slice(
  source.indexOf('async function loadArea'),
  source.indexOf('function updateBedStatus'),
);
assert.match(loadAreaBody, /loadBedDeviceDetails/);

const enterRoomIndex = source.indexOf('function enterRoom');
assert.ok(enterRoomIndex >= 0, 'enterRoom should remain the ward interior entry point');
const enterRoomBody = source.slice(enterRoomIndex, source.indexOf('\n  }', enterRoomIndex) + 4);
assert.match(enterRoomBody, /loadCurrentWardBedDetails/);
const bedLoadIndex = source.indexOf('async function loadCurrentWardBedDetails');
assert.ok(bedLoadIndex >= 0, 'ward entry should define a deferred bed detail loader');
const bedLoadBody = source.slice(bedLoadIndex, source.indexOf('\n  }', bedLoadIndex) + 4);
assert.match(bedLoadBody, /loadBedDeviceDetails/);
assert.match(bedLoadBody, /bedDetailsLoading/);
assert.match(bedLoadBody, /bedDetailsError/);
assert.match(bedLoadBody, /bedDetailsRequestGeneration/);
assert.match(source, /loadBedDeviceDetails\(\s*room\.beds,/);
assert.match(source, /\(\) => requestGeneration === bedDetailsRequestGeneration/);
assert.match(app, /bedDetailsLoading/);
assert.match(app, /bedDetailsError/);
assert.match(app, /正在加载床头屏信息/);

const sceneTypeIndex = source.indexOf('function setSceneType');
const sceneTypeBody = source.slice(sceneTypeIndex, source.indexOf('\n  }', sceneTypeIndex) + 4);
assert.match(sceneTypeBody, /type === 'ward-interior'.*loadCurrentWardBedDetails/s);
assert.match(sceneTypeBody, /bedDetailsRequestGeneration \+= 1/);
assert.match(sceneTypeBody, /bedDetailsLoading\.value = false/);
assert.match(sceneTypeBody, /bedDetailsError\.value = null/);
