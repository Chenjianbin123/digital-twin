import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reactive, watch, nextTick } from 'vue';
import { ENV_ROOM_POLL_MS, ENV_AREA_POLL_MS, ENV_MAX_CONCURRENT_REQUESTS } from '../src/core/environment-state.ts';

async function harness(run) {
  const saved = { setInterval, clearInterval };
  const originalNow = Date.now;
  let now = 1_800_000_000_000;
  Date.now = () => now;
  const timers = new Map();
  let counter = 0;
  let visible = true;
  let listener;
  const requests = [];
  const updates = [];
  let inFlight = 0;
  let peakInFlight = 0;
  const store = reactive({ selectedAreaId: 1, currentRoomIndex: 0, sceneType: 'ward-interior',
    wardInteriorView: '3d',
    area: { rooms: ['A', 'B', 'C'].map(sickroomId => ({ sickroomId })) },
    updateEnv(areaId, id, env) {
      updates.push([areaId, id, env]);
      this.area.rooms.find(r => r.sickroomId === id).doorEnvData = env;
    },
  });
  globalThis.setInterval = (callback, intervalMs) => { timers.set(++counter, { callback, intervalMs }); return counter; };
  globalThis.clearInterval = id => timers.delete(id);
  const key = `envTest${Math.random()}`;
  globalThis[key] = { watch, ENV_ROOM_POLL_MS, ENV_AREA_POLL_MS, ENV_MAX_CONCURRENT_REQUESTS,
    fetchDoorEnvData: id => new Promise((resolve, reject) => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      let settled = false;
      const finish = (callback, value) => {
        assert.equal(settled, false, 'a mocked request must settle only once');
        settled = true;
        inFlight--;
        callback(value);
      };
      requests.push({ id, resolve: value => finish(resolve, value), reject: error => finish(reject, error) });
    }),
    createBrowserPollingVisibility: () => ({ isVisible: () => visible,
      subscribe: cb => { listener = cb; return () => { listener = undefined; }; } }),
  };
  const source = stripTypeScriptTypes(fs.readFileSync('src/services/env-fetcher.ts', 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  const module = await import(`data:text/javascript;base64,${Buffer.from(`const {watch, fetchDoorEnvData, createBrowserPollingVisibility, ENV_ROOM_POLL_MS, ENV_AREA_POLL_MS, ENV_MAX_CONCURRENT_REQUESTS} = globalThis[${JSON.stringify(key)}];\n${source}`).toString('base64')}`);
  const flush = async () => { for (let index = 0; index < 8; index++) await nextTick(); };
  try {
    await run({ module, store, requests, updates, timers, flush,
      tick: async () => { for (const { callback } of [...timers.values()]) callback(); await flush(); },
      visibility: async value => { visible = value; listener?.(value); await flush(); },
      advance: milliseconds => { now += milliseconds; },
      concurrency: () => ({ current: inFlight, peak: peakInFlight }),
    });
  } finally {
    module.stopEnvFetcher();
    Object.assign(globalThis, saved);
    Date.now = originalNow;
    delete globalThis[key];
  }
}

test('interior polls one room every 60s and coalesces pending requests', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  assert.deepEqual([...h.timers.values()].map(timer => timer.intervalMs), [60_000]);
  assert.deepEqual(h.requests.map(r => r.id), ['A']);
  await h.tick();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve({ temp: '24' }); await h.flush();
  await h.tick();
  assert.equal(h.requests.length, 2);
}));

test('room switching cannot apply old room response; overview fetches other rooms', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.store.currentRoomIndex = 1; await h.flush();
  assert.deepEqual(h.requests.map(r => r.id), ['A', 'B']);
  h.requests[0].resolve({ temp: 'OLD' });
  h.requests[1].resolve({ temp: '25' }); await h.flush();
  assert.deepEqual(h.updates.map(u => u[1]), ['B']);
  h.store.sceneType = 'ward'; await h.flush();
  assert.deepEqual(h.requests.map(r => r.id), ['A', 'B', 'A', 'C']);
}));

test('background pauses timers, foreground refreshes once, stop cleans listeners', () => harness(async h => {
  await h.visibility(false);
  h.module.startEnvFetcher(h.store);
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
  await h.visibility(true);
  assert.equal(h.requests.length, 1);
  await h.visibility(false); await h.tick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.size, 0);
  h.requests[0].resolve({ temp: '24' }); await h.flush();
  await h.visibility(true);
  assert.equal(h.requests.length, 2);
  h.module.stopEnvFetcher();
  await h.visibility(true); await h.tick();
  h.requests[1].resolve({ temp: 'LATE' }); await h.flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.updates.length, 1);
}));

test('failure and empty response preserve last reading and success time; retry recovers', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.requests[0].resolve({ temp: '24' }); await h.flush();
  const room = h.store.area.rooms[0];
  const at = room.envSync.lastSuccessAt;
  await h.tick(); h.requests[1].reject(new Error('offline')); await h.flush();
  assert.equal(room.envSync.failed, true);
  assert.equal(room.envSync.lastSuccessAt, at);
  assert.equal(room.doorEnvData.temp, '24');
  await h.tick(); h.requests[2].resolve(undefined); await h.flush();
  assert.equal(room.doorEnvData.temp, '24');
  await h.tick(); h.requests[3].resolve({ temp: '26' }); await h.flush();
  assert.equal(room.envSync.failed, false);
  assert.equal(room.doorEnvData.temp, '26');
}));

test('area change and session restart reject previous responses; same-room view switches reuse readings', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.store.selectedAreaId = 2;
  h.store.area = { rooms: [{ sickroomId: 'A' }] }; await h.flush();
  assert.equal(h.requests.length, 2);
  h.requests[0].resolve({ temp: 'OLD' });
  h.requests[1].resolve({ temp: '24' }); await h.flush();
  assert.deepEqual(h.updates.map(u => u[0]), [2]);
  h.store.wardInteriorView = 'plan'; await h.flush();
  h.store.wardInteriorView = '3d'; await h.flush();
  assert.equal(h.requests.length, 2);
  await h.tick();
  h.module.startEnvFetcher(h.store);
  h.requests[2].resolve({ temp: 'OLD SESSION' }); await h.flush();
  assert.equal(h.updates.length, 1);
  h.requests[3].resolve({ temp: 'NEW SESSION' }); await h.flush();
  assert.equal(h.updates.length, 2);
}));

test('snapshot replacement waits for same-room pending request then refreshes new object', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.store.area = { rooms: [{ sickroomId: 'A' }] }; await h.flush();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve({ temp: 'OLD SNAPSHOT' }); await h.flush();
  assert.equal(h.updates.length, 0);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ temp: '24' }); await h.flush();
  assert.equal(h.store.area.rooms[0].doorEnvData.temp, '24');
}));

test('overview uses 120s, mode changes reset interval, and 3D-plan switch keeps the same timer', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.requests[0].resolve({ temp: '24' }); await h.flush();
  const roomTimer = [...h.timers.keys()][0];
  h.store.wardInteriorView = 'plan'; await h.flush();
  assert.deepEqual([...h.timers.keys()], [roomTimer]);
  assert.equal(h.requests.length, 1);
  h.store.sceneType = 'ward'; await h.flush();
  assert.deepEqual([...h.timers.values()].map(timer => timer.intervalMs), [120_000]);
  assert.notEqual([...h.timers.keys()][0], roomTimer);
  assert.deepEqual(h.requests.map(request => request.id), ['A', 'B', 'C']);
  h.store.sceneType = 'ward-interior'; await h.flush();
  assert.deepEqual([...h.timers.values()].map(timer => timer.intervalMs), [60_000]);
  assert.deepEqual(h.requests.map(request => request.id), ['A', 'B', 'C', 'A']);
}));

test('switching rooms immediately rechecks a fresh previously visited room', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.requests[0].resolve({ temp: '24' }); await h.flush();
  const firstTimer = [...h.timers.keys()][0];
  h.advance(59_000);
  h.store.currentRoomIndex = 1; await h.flush();
  const secondTimer = [...h.timers.keys()][0];
  assert.notEqual(secondTimer, firstTimer, 'new room must receive a full interval after its immediate request');
  assert.equal(h.timers.size, 1);
  assert.equal(h.timers.get(secondTimer).intervalMs, 60_000);
  h.requests[1].resolve({ temp: '25' }); await h.flush();
  h.store.currentRoomIndex = 0; await h.flush();
  assert.notEqual([...h.timers.keys()][0], secondTimer);
  assert.deepEqual(h.requests.map(request => request.id), ['A', 'B', 'A']);
}));

test('switching areas in overview resets the 120s interval after its immediate refresh', () => harness(async h => {
  h.store.sceneType = 'ward';
  h.module.startEnvFetcher(h.store);
  for (const request of h.requests) request.resolve({ temp: '24' });
  await h.flush();
  const oldTimer = [...h.timers.keys()][0];
  h.advance(119_000);
  h.store.selectedAreaId = 2;
  h.store.area = { rooms: [{ sickroomId: 'D' }] };
  await h.flush();
  assert.equal(h.requests.at(-1).id, 'D');
  assert.equal(h.timers.size, 1);
  assert.notEqual([...h.timers.keys()][0], oldTimer);
  assert.equal([...h.timers.values()][0].intervalMs, 120_000);
}));

test('overview processes all rooms while peak concurrency stays at four', () => harness(async h => {
  h.store.sceneType = 'ward';
  h.store.area.rooms = Array.from({ length: 9 }, (_, index) => ({ sickroomId: `R${index}` }));
  h.module.startEnvFetcher(h.store);
  assert.equal(h.requests.length, 4);
  assert.deepEqual(h.concurrency(), { current: 4, peak: 4 });
  await h.tick();
  assert.equal(h.requests.length, 4);
  for (let index = 0; index < 9; index++) {
    h.requests[index].resolve({ temp: '24' }); await h.flush();
    assert.ok(h.concurrency().current <= 4);
  }
  assert.equal(h.requests.length, 9);
  assert.equal(h.updates.length, 9);
  assert.deepEqual(h.concurrency(), { current: 0, peak: 4 });
}));

test('leaving overview removes old queued targets while prior in-flight calls still count', () => harness(async h => {
  h.store.sceneType = 'ward';
  h.store.area.rooms = 'ABCDEFG'.split('').map(sickroomId => ({ sickroomId }));
  h.module.startEnvFetcher(h.store);
  h.store.currentRoomIndex = 6;
  h.store.sceneType = 'ward-interior'; await h.flush();
  assert.deepEqual(h.requests.map(request => request.id), ['A', 'B', 'C', 'D']);
  h.requests[0].resolve({ temp: 'OLD A' }); await h.flush();
  assert.deepEqual(h.requests.map(request => request.id), ['A', 'B', 'C', 'D', 'G']);
  for (let index = 1; index < 5; index++) { h.requests[index].resolve({ temp: '24' }); await h.flush(); }
  assert.deepEqual(h.updates.map(update => update[1]), ['G']);
  assert.deepEqual(h.concurrency(), { current: 0, peak: 4 });
}));

test('stop and restart preserve the global limit and never send requests from the old queue', () => harness(async h => {
  h.store.sceneType = 'ward';
  h.store.area.rooms = 'ABCDEFGH'.split('').map(sickroomId => ({ sickroomId }));
  h.module.startEnvFetcher(h.store);
  h.module.stopEnvFetcher();
  h.store.selectedAreaId = 2;
  h.store.area.rooms = 'WXYZ'.split('').map(sickroomId => ({ sickroomId }));
  h.module.startEnvFetcher(h.store);
  assert.equal(h.requests.length, 4);
  for (let index = 0; index < 4; index++) { h.requests[index].resolve({ temp: 'OLD' }); await h.flush(); }
  assert.deepEqual(h.requests.map(request => request.id), 'ABCDWXYZ'.split(''));
  assert.equal(h.updates.length, 0);
  assert.deepEqual(h.concurrency(), { current: 4, peak: 4 });
  h.module.stopEnvFetcher();
  for (let index = 4; index < 8; index++) { h.requests[index].resolve({ temp: 'LATE' }); await h.flush(); }
  assert.equal(h.requests.length, 8);
  assert.equal(h.updates.length, 0);
  assert.equal(h.timers.size, 0);
}));

test('hidden overview cancels unsent work and foreground immediately starts a bounded refresh', () => harness(async h => {
  h.store.sceneType = 'ward';
  h.store.area.rooms = 'ABCDEFGH'.split('').map(sickroomId => ({ sickroomId }));
  h.module.startEnvFetcher(h.store);
  await h.visibility(false);
  for (let index = 0; index < 4; index++) { h.requests[index].resolve({ temp: '24' }); await h.flush(); }
  assert.equal(h.requests.length, 4);
  assert.equal(h.timers.size, 0);
  await h.visibility(true);
  assert.equal(h.requests.length, 8);
  assert.deepEqual(h.concurrency(), { current: 4, peak: 4 });
  assert.deepEqual([...h.timers.values()].map(timer => timer.intervalMs), [120_000]);
}));

test('unchanged normalized readings retain data identity but update receipt time and clear failure', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.requests[0].resolve({ temp: 24, relativeHumid: '50', airQuality: '80', noiseLevel: '20' }); await h.flush();
  const room = h.store.area.rooms[0];
  const original = room.doorEnvData;
  const receivedAt = room.envSync.lastSuccessAt;
  h.advance(60_000); await h.tick();
  h.requests[1].resolve({ noiseLevel: '20', airQuality: '80', relativeHumid: '50', temp: '24' }); await h.flush();
  assert.equal(h.updates.length, 1);
  assert.strictEqual(room.doorEnvData, original);
  assert.equal(room.envSync.lastSuccessAt, receivedAt + 60_000);
  h.advance(60_000); await h.tick();
  h.requests[2].reject(new Error('offline')); await h.flush();
  assert.equal(room.envSync.failed, true);
  h.advance(60_000); await h.tick();
  h.requests[3].resolve({ temp: '24', relativeHumid: '50', airQuality: '80', noiseLevel: '20' }); await h.flush();
  assert.equal(h.updates.length, 1);
  assert.equal(room.envSync.failed, false);
  assert.equal(room.envSync.lastSuccessAt, receivedAt + 180_000);
  h.advance(60_000); await h.tick();
  h.requests[4].resolve({ temp: '24', relativeHumid: '50', airQuality: '80' }); await h.flush();
  assert.equal(h.updates.length, 2, 'a removed reading is still a data change');
  assert.equal(room.doorEnvData.noiseLevel, undefined);
}));
