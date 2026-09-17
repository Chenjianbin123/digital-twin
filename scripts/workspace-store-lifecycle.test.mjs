import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

process.env.VITE_DATA_SOURCE = 'database';
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval, localStorage: storage, sessionStorage: storage };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const originalFetch = globalThis.fetch;
const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
const response = name => ({ ok: true, status: 200, json: async () => ({ data: {
  area: { areaName: name, areaCode: 'A', deptName: 'test', rooms: [{ sickroomName: 'R', sickroomCode: 'R', sickroomId: 'R', deviceCode: 'D', beds: [] }] },
  deviceCodes: [], history: [], hospitalInfo: null, warnings: [], fetchedAt: '',
} }) });
try {
  await test('logout invalidates local-area load before it can restore cleared data', async () => {
    setActivePinia(createPinia()); const store = useTwinStore();
    let resolve;
    globalThis.fetch = () => new Promise(done => { resolve = done; });
    const pending = store.loadArea(); assert.ok(resolve);
    store.clearSessionState(); resolve(response('old')); await pending;
    assert.equal(store.area, null); assert.equal(store.dataPhase, 'idle');
    assert.equal(store.isLoading, false);
  });
  await test('late local success and failure cannot overwrite newer loading or data', async () => {
    setActivePinia(createPinia()); const store = useTwinStore();
    const requests = [];
    globalThis.fetch = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
    const old = store.loadArea(); const latest = store.loadArea();
    requests[0].reject(new Error('old failure')); await old;
    assert.equal(store.error, null); assert.equal(store.isLoading, true);
    requests[1].resolve(response('new')); await latest;
    assert.equal(store.area.areaName, 'new'); assert.equal(store.isLoading, false);
    const older = store.loadArea(); const newer = store.loadArea();
    requests[3].resolve(response('newest')); await newer;
    requests[2].resolve(response('obsolete')); await older;
    assert.equal(store.area.areaName, 'newest'); store.clearSessionState();
  });
} finally { globalThis.fetch = originalFetch; await server.close(); }
