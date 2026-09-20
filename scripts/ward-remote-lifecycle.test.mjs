import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

// All HTTP calls are intercepted; no real session or backend is used.
process.env.VITE_DATA_SOURCE = 'remote';
process.env.VITE_API_TOKEN = 'fixture-only';
process.env.VITE_DEVICE_HOST = 'http://ward.test/swp';
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval, location: { origin: 'http://ward.test' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalFetch = globalThis.fetch;
const template = JSON.parse(fs.readFileSync(new URL('../src/mock/bed-template-default.json', import.meta.url), 'utf8'));
let occupants = ['P1', 'P2', null];
let offline = false;
let failedBed = '';
const calls = [];
const reply = data => ({ ok: true, status: 200, json: async () => ({ code: 200, data }) });
globalThis.fetch = async (url, options = {}) => {
  const path = String(url); const body = JSON.parse(options.body || '{}');
  calls.push(path.split('/').at(-1));
  if (offline) throw new Error('fixture offline');
  if (path.includes('querySwpDeviceInfo')) return reply({ records: [{ id: 1, areaId: 1, deviceCode: 'DOOR-1', deviceName: '101', devicePlace: '101', isEnable: '1', sort: 1 }], pages: 1 });
  if (path.includes('doorDevice/queryBaseDeviceInfo')) return reply({
    doorDeviceInfo: { id: 1, deviceCode: 'DOOR-1', deviceName: '101', deviceTypeCode: '201', areaId: 1, sickroomId: '101', sickroomCode: '101', sickroomName: '101', templateId: 1 },
    bedDeviceList: [1, 2, 3].map(n => ({ id: n, bedCode: String(n), bedName: String(n), deviceCode: 'BED-' + n, bedSort: String(n), isOnline: '1' })),
    // Deliberately stale door snapshot: the bed endpoint must be authoritative.
    doorSickInfoList: [1, 2].map(n => ({ bedCode: String(n), sickName: '旧门口信息', sickNo: 'OLD-' + n })),
  });
  if (path.includes('bedDevice/queryBaseDeviceInfo')) {
    if (body.deviceCode === failedBed) throw new Error('fixture partial failure');
    const n = Number(body.deviceCode.split('-').at(-1)); const patient = occupants[n - 1];
    return reply({ bedDeviceInfoVo: { deviceCode: body.deviceCode, bedCode: String(n), bedName: String(n), templateId: 1, isOnline: '1' }, bedSickInfoVo: patient ? { bedCode: String(n), sickNo: patient, sickName: '测试' + patient } : null, bedSickNursingLabelList: [] });
  }
  if (path.includes('querySwpTemplateInfoById')) return reply({ id: 1, analyzeType: '1', templateContent: template.templateContent });
  if (path.includes('queryHospHospitalInfo')) return reply({ hospitalName: '闭环测试医院' });
  throw new Error('Unexpected fixture request: ' + path);
};
try {
  const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
  const { selectOccupiedWardBeds } = await server.ssrLoadModule('/src/core/ward-interior-beds.ts');
  setActivePinia(createPinia()); const store = useTwinStore();
  store.dataSource = 'remote'; store.selectedAreaId = 1;
  store.areaOptions = [{ id: 1, areaCode: '1', areaName: '测试病区' }];
  assert.equal(await store.refreshCurrentArea(), true);
  store.enterRoom(0);
  while (store.bedDetailsLoading) await new Promise(r => setTimeout(r, 5));
  const count = () => selectOccupiedWardBeds(store.currentWard).beds.length;
  const counts = [count()];
  for (const next of [['P1', 'P2', 'P3'], [null, 'P2', 'P3'], [null, 'NEW', 'P3'], [null, null, null], ['RETURN', null, null]]) {
    occupants = next;
    assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), true);
    assert.equal(store.sceneType, 'ward-interior');
    assert.equal(store.currentWard.sickroomCode, '101');
    counts.push(count());
    assert.deepEqual(store.currentWard.beds.map(b => b.sickInfo?.sickNo ?? null), next);
  }
  assert.deepEqual(counts, [2, 3, 2, 2, 0, 1]);
  failedBed = 'BED-1';
  assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), true);
  assert.ok(store.dataWarnings.some(w => w.includes('BED-1')));
  assert.ok(store.bedDetailsError);
  failedBed = ''; offline = true;
  const last = store.area;
  assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), false);
  assert.equal(store.area, last); assert.equal(store.dataPhase, 'error');
  offline = false; occupants = [null, 'RECOVERED', null];
  assert.equal(await store.refreshCurrentArea({ preserveScene: true, silent: true }), true);
  assert.equal(store.bedDetailsError, null); assert.equal(store.dataPhase, 'ready');
  assert.equal(count(), 1); assert.equal(store.currentWard.beds[1].sickInfo.sickNo, 'RECOVERED');
  assert.ok(calls.includes('querySwpDeviceInfo'));
  // Store-only navigation must not fetch templates; the visible scene owns that work.
  assert.equal(calls.includes('querySwpTemplateInfoById'), false);
  console.log('Remote API adapter → mapping → Pinia → occupied beds: passed', counts);
}
finally { globalThis.fetch = originalFetch; await server.close(); }
