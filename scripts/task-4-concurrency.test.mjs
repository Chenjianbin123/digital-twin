import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';

process.env.VITE_REALTIME_URL = 'ws://realtime.test/events?transport=websocket#stream';
process.env.VITE_ALERT_ACK_PATH = '/test/alert-ack';
process.env.VITE_API_TOKEN = 'test-token';

const localStorageValues = new Map();
let localStorageReadFailure = false;
let localStorageWriteFailure = false;
globalThis.window = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  localStorage: {
    getItem(key) {
      if (localStorageReadFailure)
        throw new Error('storage read denied');
      return localStorageValues.get(key) ?? null;
    },
    setItem(key, value) {
      if (localStorageWriteFailure)
        throw new Error('storage write denied');
      localStorageValues.set(key, String(value));
    },
    removeItem: key => localStorageValues.delete(key),
  },
};

class FakeWebSocket {
  static instances = [];

  listeners = new Map();

  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {}

  capture(type) {
    return [...(this.listeners.get(type) ?? [])];
  }

  emit(type, event = {}) {
    this.capture(type).forEach(listener => listener(event));
  }
}

globalThis.WebSocket = FakeWebSocket;

function apiResponse(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
  };
}

let envRequestCount = 0;
async function mockRemoteApiFetch(url, options = {}) {
  const path = String(url);
  const body = options.body ? JSON.parse(options.body) : {};
  if (path.includes('querySwpDeviceInfo')) {
    const areaId = Number(body.areaId || 1);
    return apiResponse({
      code: 200,
      data: {
        records: [{
          id: areaId,
          areaId,
          deviceCode: `DOOR-${areaId}`,
          deviceName: `${areaId}区门口机`,
          devicePlace: `${areaId}01`,
          isEnable: '1',
          sort: 1,
        }],
        pages: 1,
      },
    });
  }
  if (path.includes('doorDevice/queryBaseDeviceInfo')) {
    const areaId = Number(String(body.deviceCode || '').split('-').at(-1) || 1);
    return apiResponse({
      code: 200,
      data: {
        doorDeviceInfo: {
          deviceCode: body.deviceCode,
          deviceName: `${areaId}区门口机`,
          areaId,
          sickroomId: String(areaId * 100 + 1),
          sickroomName: `${areaId}01`,
          sickroomCode: `${areaId}01`,
          templateId: 0,
        },
        bedDeviceList: [],
        doorSickInfoList: [],
      },
    });
  }
  if (path.includes('queryHospHospitalInfo'))
    return apiResponse({ code: 200, data: { hospitalName: '测试医院' } });

  envRequestCount += 1;
  return apiResponse({
    code: 200,
    data: [{ deviceActionCode: 'temp', deviceActionValue: '25' }],
  });
}

globalThis.fetch = mockRemoteApiFetch;

function createArea(areaCode = 'A') {
  return {
    areaName: `${areaCode}病区`,
    areaCode,
    deptName: `${areaCode}科室`,
    rooms: [{
      sickroomName: `${areaCode}01`,
      sickroomCode: `${areaCode}01`,
      sickroomId: areaCode === 'A' ? '101' : '201',
      deviceCode: `DOOR-${areaCode}`,
      beds: [],
    }],
  };
}

function createBed(bedCode = '01') {
  return {
    bedCode,
    bedName: `${bedCode}床`,
    deviceCode: `BED-${bedCode}`,
    position: { x: 0, z: 0 },
    isOccupied: true,
    isOnline: true,
  };
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs)
      throw new Error('timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 2));
  }
}

const server = await createServer({
  mode: 'task4-test',
  server: { middlewareMode: true },
  appType: 'custom',
});

let failures = 0;

async function run(name, test) {
  try {
    await test();
    console.log(`PASS ${name}`);
  }
  catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

try {
  const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
  const {
    startRemoteAreaFetcher,
    stopRemoteAreaFetcher,
  } = await server.ssrLoadModule('/src/services/remote-area-fetcher.ts');
  const {
    startEnvFetcher,
    stopEnvFetcher,
  } = await server.ssrLoadModule('/src/services/env-fetcher.ts');
  const {
    startRealtimeChannel,
    stopRealtimeChannel,
  } = await server.ssrLoadModule('/src/services/realtime-channel.ts');

  await run('selecting active area cancels pending switch and restores services', async () => {
    setActivePinia(createPinia());
    const store = useTwinStore();
    store.dataSource = 'remote';
    store.area = createArea('A');
    store.selectedAreaId = 1;
    store.areaOptions = [
      { id: 1, areaName: 'A病区', areaCode: 'A' },
      { id: 2, areaName: 'B病区', areaCode: 'B' },
    ];

    const requestCountBeforeCancel = envRequestCount;
    const pendingSwitch = store.switchArea(2);
    assert.equal(store.isAreaSwitching, true);

    const switchedBack = await store.switchArea(1);
    await Promise.resolve();
    const realtimeConnectionsAfterCancel = FakeWebSocket.instances.length;
    const pendingResult = await pendingSwitch;
    store.stopRemoteServices();

    assert.equal(switchedBack, true);
    assert.equal(pendingResult, false);
    assert.equal(store.selectedAreaId, 1);
    assert.equal(store.area?.areaCode, 'A');
    assert.equal(store.pendingAreaId, null);
    assert.equal(store.isAreaSwitching, false);
    assert.ok(envRequestCount > requestCountBeforeCancel);
    assert.equal(FakeWebSocket.instances.length, realtimeConnectionsAfterCancel);
  });

  await run('superseded manual refresh releases its loading state', async () => {
    globalThis.fetch = mockRemoteApiFetch;
    setActivePinia(createPinia());
    const store = useTwinStore();
    store.dataSource = 'remote';
    store.area = createArea('A');
    store.selectedAreaId = 1;
    store.areaOptions = [{ id: 2, areaName: 'B病区', areaCode: 'B' }];

    const refresh = store.refreshCurrentArea();
    assert.equal(store.isLoading, true);
    const switching = store.switchArea(2);
    const [refreshResult, switchResult] = await Promise.all([refresh, switching]);
    store.stopRemoteServices();

    assert.equal(refreshResult, false);
    assert.equal(switchResult, true, store.areaSwitchError ?? '病区切换应成功');
    assert.equal(store.isLoading, false);
  });

  await run('database polling refreshes the selected authorized area', async () => {
    let loadCount = 0;
    let remoteRefreshCount = 0;
    const store = {
      dataSource: 'database',
      async loadArea() {
        loadCount += 1;
      },
      async refreshCurrentArea() {
        remoteRefreshCount += 1;
      },
    };

    startRemoteAreaFetcher(store, 5);
    await new Promise(resolve => setTimeout(resolve, 20));
    stopRemoteAreaFetcher();

    assert.equal(loadCount, 0);
    assert.ok(remoteRefreshCount > 0);
  });

  await run('successful empty area list does not create a loading error', async () => {
    globalThis.fetch = async () => apiResponse({
      code: 200,
      data: { records: [], pages: 1 },
    });
    setActivePinia(createPinia());
    const store = useTwinStore();

    await store.loadAreaOptions();

    assert.deepEqual(store.areaOptions, []);
    assert.equal(store.preferredAreaId, null);
    assert.equal(store.areaListError, null);
    assert.equal(store.isAreaListLoading, false);
  });

  await run('invalid remembered area is cleared without auto-selecting a fallback', async () => {
    const storageKey = 'ward-digital-twin:last-area-id';
    localStorageValues.set(storageKey, '999');
    globalThis.fetch = async () => apiResponse({
      code: 200,
      data: {
        records: [{ id: 1, areaName: 'A病区', areaCode: 'A', isEnable: '1' }],
        pages: 1,
      },
    });
    setActivePinia(createPinia());
    const store = useTwinStore();

    await store.loadAreaOptions();

    assert.equal(store.rememberedAreaId, null);
    assert.equal(store.preferredAreaId, 1);
    assert.equal(localStorageValues.has(storageKey), false);
  });

  await run('storage read failure preserves the loaded area list', async () => {
    globalThis.fetch = async () => apiResponse({
      code: 200,
      data: {
        records: [{ id: 1, areaName: 'A病区', areaCode: 'A', isEnable: '1' }],
        pages: 1,
      },
    });
    setActivePinia(createPinia());
    const store = useTwinStore();

    localStorageReadFailure = true;
    await store.loadAreaOptions();
    localStorageReadFailure = false;

    assert.deepEqual(store.areaOptions, [{
      id: 1,
      areaName: 'A病区',
      areaCode: 'A',
      areaOutCode: '',
      isEnable: '1',
    }]);
    assert.equal(store.rememberedAreaId, null);
    assert.equal(store.preferredAreaId, 1);
    assert.equal(store.areaListError, null);
  });

  await run('storage write failure does not fail a successful area entry', async () => {
    globalThis.fetch = mockRemoteApiFetch;
    setActivePinia(createPinia());
    const store = useTwinStore();
    store.dataSource = 'remote';
    store.areaOptions = [{ id: 2, areaName: 'B病区', areaCode: 'B' }];

    localStorageWriteFailure = true;
    const success = await store.enterArea(2);
    localStorageWriteFailure = false;
    store.stopRemoteServices();

    assert.equal(success, true, store.areaSwitchError ?? '病区进入应成功');
    assert.equal(store.selectedAreaId, 2);
    assert.equal(store.rememberedAreaId, 2);
    assert.equal(store.area?.areaName, 'B病区');
    assert.equal(store.areaSwitchError, null);
  });

  await run('stopped env generation cannot update the next area', async () => {
    let resolveRequest;
    let requestStarted;
    const started = new Promise(resolve => {
      requestStarted = resolve;
    });
    globalThis.fetch = () => {
      requestStarted();
      return new Promise(resolve => {
        resolveRequest = () => resolve(apiResponse({
          code: 200,
          data: [{ deviceActionCode: 'temp', deviceActionValue: '26' }],
        }));
      });
    };

    let updateCount = 0;
    const store = {
      area: createArea('A'),
      selectedAreaId: 1,
      updateEnv() {
        updateCount += 1;
      },
    };

    startEnvFetcher(store, 60_000);
    await started;
    stopEnvFetcher();
    store.selectedAreaId = 2;
    store.area = createArea('B');
    resolveRequest();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(updateCount, 0);
  });

  await run('realtime requires matching area scope and invalidates stopped callbacks', async () => {
    FakeWebSocket.instances.length = 0;
    const mutations = [];
    const store = {
      selectedAreaId: 1,
      dataSource: 'remote',
      setBedCalling(...args) {
        mutations.push(['call', ...args]);
      },
      updateBedStatus(...args) {
        mutations.push(['status', ...args]);
      },
      refreshCurrentArea() {
        mutations.push(['refresh']);
      },
    };

    assert.equal(startRealtimeChannel(store), true);
    const oldSocket = FakeWebSocket.instances.at(-1);
    const oldSocketUrl = new URL(oldSocket.url);
    assert.equal(oldSocketUrl.searchParams.get('areaId'), '1');
    assert.equal(oldSocketUrl.searchParams.get('transport'), 'websocket');
    assert.equal(oldSocketUrl.hash, '');
    const stoppedMessageCallbacks = oldSocket.capture('message');
    const stoppedCloseCallbacks = oldSocket.capture('close');

    oldSocket.emit('message', {
      data: JSON.stringify({ type: 'bed-call', payload: { bedCode: '01', calling: true } }),
    });
    assert.equal(mutations.length, 0);

    oldSocket.emit('message', {
      data: JSON.stringify({ areaId: 1, type: 'bed-call', payload: { bedCode: '01', calling: true } }),
    });
    assert.deepEqual(mutations, [['call', 1, '01', true]]);

    stopRealtimeChannel();
    store.selectedAreaId = 2;
    assert.equal(startRealtimeChannel(store), true);
    const currentSocketCount = FakeWebSocket.instances.length;
    stoppedMessageCallbacks.forEach(listener => listener({
      data: JSON.stringify({ areaId: 1, type: 'bed-call', payload: { bedCode: '01', calling: false } }),
    }));

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, ms, ...args) => originalSetTimeout(callback, ms === 5_000 ? 0 : ms, ...args);
    try {
      stoppedCloseCallbacks.forEach(listener => listener({}));
      await new Promise(resolve => originalSetTimeout(resolve, 5));
    }
    finally {
      globalThis.setTimeout = originalSetTimeout;
      stopRealtimeChannel();
    }

    assert.deepEqual(mutations, [['call', 1, '01', true]]);
    assert.equal(FakeWebSocket.instances.length, currentSocketCount);
  });

  await run('store realtime mutations reject a stale expected area', async () => {
    setActivePinia(createPinia());
    const store = useTwinStore();
    const area = createArea('B');
    area.rooms[0].beds = [createBed('01')];
    store.area = area;
    store.selectedAreaId = 2;

    assert.equal(store.setBedCalling(1, '01', true), false);
    assert.equal(store.updateBedStatus(1, '01', { bedCode: '01', battery: 20 }), false);
    assert.equal(store.area.rooms[0].beds[0].isCalling, undefined);
    assert.equal(store.area.rooms[0].beds[0].statusBarInfo, undefined);
    assert.equal(store.statusHistory.length, 0);
  });

  await run('alert sync failure from a previous area cannot write current history', async () => {
    let rejectSync;
    let syncStarted;
    const started = new Promise(resolve => {
      syncStarted = resolve;
    });
    globalThis.fetch = () => {
      syncStarted();
      return new Promise((_, reject) => {
        rejectSync = reject;
      });
    };

    setActivePinia(createPinia());
    const store = useTwinStore();
    const area = createArea('A');
    const bed = createBed('01');
    bed.isCalling = true;
    area.rooms[0].beds = [bed];
    store.area = area;
    store.selectedAreaId = 1;
    store.alertAckRecords = {};
    const task = store.alertTasks.find(item => item.type === 'call');
    assert.ok(task);

    store.markAlertHandling(task.id);
    await started;
    store.selectedAreaId = 2;
    store.area = createArea('B');
    store.statusHistory = [];
    rejectSync(new Error('old area sync failed'));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(store.statusHistory, []);
  });

  await run('env responses relocate by sickroom id and newest request wins', async () => {
    const pending = [];
    globalThis.fetch = (_url, options) => new Promise(resolve => {
      const sickroomId = JSON.parse(options.body).sickroomId;
      pending.push({
        sickroomId,
        resolve: value => resolve(apiResponse({
          code: 200,
          data: [{ deviceActionCode: 'temp', deviceActionValue: value }],
        })),
      });
    });

    const area = createArea('A');
    area.rooms.push({
      ...createArea('B').rooms[0],
      sickroomId: '102',
      sickroomCode: 'A02',
      sickroomName: 'A02',
    });
    const updates = [];
    const store = {
      area,
      selectedAreaId: 1,
      updateEnv(...args) {
        updates.push(args);
      },
    };

    startEnvFetcher(store, 5);
    try {
      await waitFor(() => pending.filter(item => item.sickroomId === 101).length >= 2);
      const room101 = pending.filter(item => item.sickroomId === 101);
      store.area = { ...store.area, rooms: [store.area.rooms[1], store.area.rooms[0]] };
      room101[1].resolve('28');
      await new Promise(resolve => setTimeout(resolve, 0));
      room101[0].resolve('21');
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.equal(updates.length, 1);
      assert.equal(updates[0][0], 1);
      assert.equal(updates[0][1], '101');
      assert.equal(updates[0][2].temp, '28℃');
    }
    finally {
      stopEnvFetcher();
      pending.forEach(request => request.resolve('25'));
    }
  });

  await run('3D identity distinguishes areas and same-area bed structure changes', async () => {
    const {
      buildAreaSceneIdentity,
      buildAreaStructureSignature,
    } = await server.ssrLoadModule('/src/core/area-scene-identity.ts');
    const areaA = createArea('SAME');
    const areaB = createArea('SAME');
    areaA.rooms[0].beds = [createBed('01')];
    areaB.rooms[0].beds = [createBed('01'), createBed('02')];

    assert.notEqual(buildAreaSceneIdentity(1), buildAreaSceneIdentity(2));
    assert.notEqual(buildAreaStructureSignature(areaA), buildAreaStructureSignature(areaB));
  });

  await run('old interval finally cannot release the current run refresh lock', async () => {
    const resolvers = [];
    let refreshCount = 0;
    const store = {
      dataSource: 'remote',
      refreshCurrentArea() {
        refreshCount += 1;
        return new Promise(resolve => resolvers.push(resolve));
      },
    };

    startRemoteAreaFetcher(store, 5);
    try {
      await waitFor(() => refreshCount === 1);
      stopRemoteAreaFetcher();
      startRemoteAreaFetcher(store, 5);
      await waitFor(() => refreshCount === 2);
      resolvers[0](true);
      await new Promise(resolve => setTimeout(resolve, 15));

      assert.equal(refreshCount, 2);
    }
    finally {
      stopRemoteAreaFetcher();
      resolvers.forEach(resolve => resolve(true));
    }
  });

  await run('overlapping reset cannot restart services during a switch', async () => {
    globalThis.fetch = mockRemoteApiFetch;
    setActivePinia(createPinia());
    const store = useTwinStore();
    store.dataSource = 'remote';
    store.area = createArea('A');
    store.selectedAreaId = 1;
    store.areaOptions = [
      { id: 1, areaName: 'A病区', areaCode: 'A' },
      { id: 2, areaName: 'B病区', areaCode: 'B' },
    ];

    const reset = store.reset();
    await new Promise(resolve => setTimeout(resolve, 50));
    const switching = store.switchArea(2);
    try {
      const requestCountAfterSwitchStoppedServices = envRequestCount;
      await reset;

      assert.equal(store.isAreaSwitching, true);
      assert.equal(envRequestCount, requestCountAfterSwitchStoppedServices);
      assert.equal(await switching, true, store.areaSwitchError ?? '重置期间病区切换应成功');
    }
    finally {
      await Promise.allSettled([reset, switching]);
      store.stopRemoteServices();
    }
  });
}
finally {
  await server.close();
}

if (failures)
  process.exitCode = 1;
