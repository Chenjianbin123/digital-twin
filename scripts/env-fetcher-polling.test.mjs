import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reactive, watch, nextTick } from 'vue';

async function harness(run) {
  const saved = { setInterval, clearInterval };
  const timers = new Map();
  let counter = 0;
  let visible = true;
  let listener;
  const requests = [];
  const updates = [];
  const store = reactive({ selectedAreaId: 1, currentRoomIndex: 0, sceneType: 'ward-interior',
    area: { rooms: ['A', 'B', 'C'].map(sickroomId => ({ sickroomId })) },
    updateEnv(areaId, id, env) {
      updates.push([areaId, id, env]);
      this.area.rooms.find(r => r.sickroomId === id).doorEnvData = env;
    },
  });
  globalThis.setInterval = callback => { timers.set(++counter, callback); return counter; };
  globalThis.clearInterval = id => timers.delete(id);
  const key = `envTest${Math.random()}`;
  globalThis[key] = { watch, fetchDoorEnvData: id => new Promise((resolve, reject) => requests.push({ id, resolve, reject })),
    createBrowserPollingVisibility: () => ({ isVisible: () => visible,
      subscribe: cb => { listener = cb; return () => { listener = undefined; }; } }),
  };
  const source = stripTypeScriptTypes(fs.readFileSync('src/services/env-fetcher.ts', 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  const module = await import(`data:text/javascript;base64,${Buffer.from(`const {watch, fetchDoorEnvData, createBrowserPollingVisibility} = globalThis[${JSON.stringify(key)}];\n${source}`).toString('base64')}`);
  const flush = async () => { await nextTick(); await Promise.resolve(); await nextTick(); };
  try {
    await run({ module, store, requests, updates, timers, flush,
      tick: async () => { for (const cb of [...timers.values()]) cb(); await flush(); },
      visibility: async value => { visible = value; listener?.(value); await flush(); },
    });
  } finally {
    module.stopEnvFetcher();
    Object.assign(globalThis, saved);
    delete globalThis[key];
  }
}

test('interior polls one room, coalesces pending requests, retains 30s refresh', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
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

test('area change and session restart reject previous responses, fresh room reuse avoids request', () => harness(async h => {
  h.module.startEnvFetcher(h.store);
  h.store.selectedAreaId = 2;
  h.store.area = { rooms: [{ sickroomId: 'A' }] }; await h.flush();
  assert.equal(h.requests.length, 2);
  h.requests[0].resolve({ temp: 'OLD' });
  h.requests[1].resolve({ temp: '24' }); await h.flush();
  assert.deepEqual(h.updates.map(u => u[0]), [2]);
  h.store.sceneType = 'ward'; await h.flush();
  h.store.sceneType = 'ward-interior'; await h.flush();
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
