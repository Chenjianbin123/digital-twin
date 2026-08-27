import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doorSource = readFileSync(new URL('../src/api/door-device.ts', import.meta.url), 'utf8');
const remoteDoorBody = doorSource.slice(
  doorSource.indexOf('async function fetchRemoteDoorDeviceList'),
  doorSource.indexOf('export async function fetchDoorDeviceList'),
);
assert.doesNotMatch(remoteDoorBody, /enrichDoorEnvData/);
assert.match(remoteDoorBody, /forceRefresh/);

const storeSource = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
const refreshIndex = storeSource.indexOf('async function refreshCurrentArea');
const refreshBody = storeSource.slice(
  refreshIndex,
  storeSource.indexOf('async function loadArea', refreshIndex),
);
assert.match(refreshBody, /fetchAreaSnapshot\(areaId,\s*\{[\s\S]*?refreshDeviceList:\s*true,[\s\S]*?preserveLastValidRooms:\s*true,[\s\S]*?\}\)/);
assert.match(refreshBody, /previousSceneType === 'ward-interior'.*loadCurrentWardBedDetails/s);

const clearIndex = storeSource.indexOf('function clearSessionState');
assert.ok(clearIndex >= 0, 'store should expose session state cleanup');
const clearBody = storeSource.slice(clearIndex, storeSource.indexOf('\n  }', clearIndex) + 4);
assert.match(clearBody, /areaRequestGuard\.begin\(\)/);
assert.match(clearBody, /areaListRequestGuard\.begin\(\)/);
assert.match(clearBody, /area\.value = null/);
assert.match(clearBody, /clearTemplateCache\(\)/);
assert.match(clearBody, /clearBedTemplateIdCache\(\)/);

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
assert.match(appSource, /handleAuthExpired[\s\S]*?store\.clearSessionState\(\)/);
assert.match(appSource, /handleLogout[\s\S]*?store\.clearSessionState\(\)/);
