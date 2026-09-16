import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

process.env.VITE_DATA_SOURCE = 'mock';
globalThis.window = {
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
};
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalFetch = globalThis.fetch;
try {
  const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
  const { wardBedPatientKey } = await server.ssrLoadModule('/src/core/ward-data-binding.ts');
  const { getMockBedDeviceInfo } = await server.ssrLoadModule('/src/mock/bed-device-info.ts');
  const { MOCK_DOOR_DEVICE_LIST } = await server.ssrLoadModule('/src/mock/door-device-list.ts');
  const sourceRoom = MOCK_DOOR_DEVICE_LIST.data[0];
  for (const sourceBed of sourceRoom.bedDeviceList) {
    const details = getMockBedDeviceInfo(sourceBed.deviceCode);
    assert.equal(details.bedDeviceInfoVo.bedCode, sourceBed.bedCode, 'mock details must resolve by device SN');
    assert.equal(details.bedSickInfoVo?.sickNo, sourceRoom.doorSickInfoList.find(p => p.bedCode === sourceBed.bedCode)?.sickNo);
  }
  setActivePinia(createPinia());
  const store = useTwinStore();
  store.selectedAreaId = 1;
  const bed = deviceCode => ({ bedCode: '01', bedName: '01', deviceCode, position: { x: 0, z: 0 }, isOccupied: true, isOnline: true });
  const area = () => ({ areaName: 'test', areaCode: '1', deptName: 'test', rooms: ['R1', 'R2'].map((r, i) => ({ sickroomCode: r, sickroomId: r, sickroomName: r, deviceCode: r, beds: [bed('SN' + i)] })) });
  store.area = area();
  assert.equal(store.updateBedStatus(1, '01', { bedCode: '01', deviceCode: 'SN1', status: '300' }), true);
  assert.equal(store.area.rooms[0].beds[0].statusBarInfo, undefined, 'same bed number in another room must not receive status');
  assert.equal(store.area.rooms[1].beds[0].statusBarInfo.status, '300');
  assert.equal(store.updateBedStatus(1, '01', { status: '301' }), false, 'ambiguous room-local code is rejected');
  assert.equal(store.updateBedStatus(1, '02', { deviceCode: 'SN1', status: '301' }), false, 'conflicting identities are rejected');
  assert.equal(store.updateBedStatus(2, '01', { deviceCode: 'SN1', status: '301' }), false, 'events from an old area are rejected');
  assert.equal(store.area.rooms[1].beds[0].statusBarInfo.status, '300');

  const patient = { ...bed('SN1'), sickInfo: { sickNo: 'P1', sickName: '测试甲' } };
  assert.equal(wardBedPatientKey(patient), wardBedPatientKey({ ...patient, isOnline: false }), 'connection changes do not clear the same patient');
  assert.notEqual(wardBedPatientKey(patient), wardBedPatientKey({ ...patient, sickInfo: { sickNo: 'P2', sickName: '测试乙' } }));
  assert.notEqual(wardBedPatientKey(patient), wardBedPatientKey({ ...patient, bedSickInfo: { sickSerialNo: 'NEW' } }));

  store.dataSource = 'database';
  store.areaOptions = [{ id: 1, areaCode: '1', areaName: 'test' }];
  store.currentRoomIndex = 0;
  store.sceneType = 'ward';
  let resolveRequest;
  globalThis.fetch = () => new Promise(resolve => { resolveRequest = resolve; });
  const refresh = store.refreshCurrentArea({ preserveScene: true, silent: true });
  assert.ok(resolveRequest);
  store.currentRoomIndex = 1;
  resolveRequest({ ok: true, status: 200, json: async () => ({ data: { area: area(), deviceCodes: [], hospitalInfo: null, warnings: [] } }) });
  assert.equal(await refresh, true);
  assert.equal(store.currentRoomIndex, 1, 'refresh must preserve navigation made while the request was pending');
  assert.equal(store.currentWard.sickroomCode, 'R2');

  const requests = [];
  globalThis.fetch = () => new Promise(resolve => requests.push(resolve));
  const oldRefresh = store.refreshCurrentArea({ preserveScene: true, silent: true });
  const newRefresh = store.refreshCurrentArea({ preserveScene: true, silent: true });
  const response = name => ({ ok: true, status: 200, json: async () => ({ data: { area: { ...area(), areaName: name }, deviceCodes: [], hospitalInfo: null, warnings: [] } }) });
  requests[1](response('latest'));
  assert.equal(await newRefresh, true);
  requests[0](response('old'));
  assert.equal(await oldRefresh, false);
  assert.equal(store.area.areaName, 'latest', 'out-of-order responses cannot overwrite current data');
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), false);
  assert.equal(store.area.areaName, 'latest', 'failed refresh retains the last valid snapshot');
  assert.equal(store.dataPhase, 'error');
  globalThis.fetch = async () => response('recovered');
  assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), true);
  assert.equal(store.dataPhase, 'ready');
  assert.equal(store.area.areaName, 'recovered');
  console.log('ward data binding, navigation race, out-of-order responses and recovery passed');
}
finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
