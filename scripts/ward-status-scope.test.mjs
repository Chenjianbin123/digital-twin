import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

// Synthetic two-room fixture; never accesses a real session or backend.
const server = await createServer({ configFile: false, appType: 'custom', plugins: [vue()],
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': resolve('src') } },
  define: { 'import.meta.env.VITE_DATA_SOURCE': '"remote"',
    'import.meta.env.VITE_API_TOKEN': '"fixture-only"', 'import.meta.env.VITE_DEVICE_HOST': '"http://fixture.test"' },
});
const originalFetch = globalThis.fetch;
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
let failSecond = false;
let holdSecond = false;
let releaseSecond;
let failedDoor = '';
let firstBedName = '208床';
let firstOccupied = true;
const reply = data => ({ ok: true, status: 200, json: async () => ({ code: 200, data }) });
globalThis.fetch = async (url, options = {}) => {
  const path = String(url), body = JSON.parse(options.body || '{}');
  if (path.includes('querySwpDeviceInfo')) return reply({ records: [1, 2].map(n => ({ id: n, deviceCode: `DOOR-${n}`, isEnable: '1' })) });
  if (path.includes('doorDevice/queryBaseDeviceInfo')) {
    if (body.deviceCode === failedDoor) throw Error('synthetic door unavailable');
    const n = body.deviceCode.endsWith('1') ? 1 : 2;
    return reply({ doorDeviceInfo: { deviceCode: body.deviceCode, sickroomId: String(n), sickroomCode: `R${n}`, sickroomName: `R${n}` },
      bedDeviceList: [{ deviceCode: n === 1 ? '' : 'SN2', bedCode: n === 1 ? '208' : '99', bedName: n === 1 ? firstBedName : '99床' }],
      doorSickInfoList: n === 1 && !firstOccupied ? [] : [{ bedCode: n === 1 ? '208' : '99', sickName: 'Synthetic', sickNo: `TEST${n}` }] });
  }
  if (path.includes('bedDevice/queryBaseDeviceInfo')) {
    if (holdSecond) await new Promise(resolve => { releaseSecond = resolve; });
    if (failSecond) throw Error('接口请求超时（6秒）：/synthetic/bed-info');
    return reply({ bedDeviceInfoVo: { deviceCode: 'SN2', bedCode: '99', bedName: '99床', templateId: 1 },
      bedSickInfoVo: { sickName: 'Synthetic', sickNo: 'TEST2' } });
  }
  if (path.includes('queryHospHospitalInfo')) return reply({ hospitalName: 'Synthetic' });
  return reply({ records: [] });
};
const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
const { resolveWardInteriorDataStatus } = await server.ssrLoadModule('/src/core/ward-interior-status.ts');
const { default: Status } = await server.ssrLoadModule('/src/components/WardInteriorStatus.vue');
setActivePinia(createPinia());
const store = useTwinStore();
const settle = async () => {
  for (let n = 0; store.bedDetailsLoading && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(store.bedDetailsLoading, false);
};
const status = () => resolveWardInteriorDataStatus({ phase: store.dataPhase, lastFetchedAtMs: store.lastFetchedAtMs,
  nowMs: Date.now(), busy: store.bedDetailsLoading, issues: store.bedDetailsIssues,
  snapshotRetained: store.currentWardSnapshotRetained });
const render = () => renderToString(createSSRApp(Status, { ward: store.currentWard, status: status(),
  busy: store.bedDetailsLoading, issues: store.bedDetailsIssues, lastSyncedAt: store.lastFetchedAtMs,
  snapshotRetained: store.currentWardSnapshotRetained }));
try {
  store.areaOptions = [{ id: 1, areaCode: '1', areaName: 'Synthetic area' }];
  await store.enterArea(1); store.stopRemoteServices();
  await test('other-room warnings stay global, current-room panel shows only its own affected bed', async () => {
    assert.ok(store.dataWarnings.some(text => text.includes('208')));
    store.enterRoom(1); await settle();
    assert.equal(status(), 'ready'); assert.deepEqual(store.bedDetailsIssues, []);
    assert.doesNotMatch(await render(), /208床|查看本病房异常|部分数据同步失败/);
    store.enterRoom(0); await settle();
    assert.equal(status(), 'warning'); assert.equal(store.bedDetailsIssues.length, 1);
    const html = await render();
    assert.match(html, /本病房 1 个床位未关联床头机/);
    assert.match(html, /208床：未关联床头机设备/);
    assert.doesNotMatch(html, /99床|部分数据同步失败/);
  });
  await test('current-room timeout is retained with a bed label and clears after recovery', async () => {
    store.enterRoom(1); await settle(); failSecond = true;
    await store.refreshWardBedDetails();
    assert.equal(store.bedDetailsIssues[0].kind, 'request-failed');
    const html = await render();
    assert.match(html, /99床：床头机信息查询超时/);
    assert.doesNotMatch(html, /208床|\/synthetic|SN2/);
    failSecond = false; await store.refreshWardBedDetails();
    assert.deepEqual(store.bedDetailsIssues, []); assert.equal(status(), 'ready');
  });
  await test('retained current-room door data remains a warning, other-room door failure does not leak', async () => {
    failedDoor = 'DOOR-2';
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
    assert.deepEqual(store.bedDetailsIssues, []);
    assert.equal(status(), 'warning');
    assert.match(await render(), /本病房门口机详情刷新失败/);
    failedDoor = 'DOOR-1';
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
    assert.equal(status(), 'ready');
    assert.doesNotMatch(await render(), /本病房门口机详情刷新失败/);
    failedDoor = ''; await store.refreshCurrentArea({ preserveScene: true, silent: true });
  });
  await test('occupied empty label warns without changing occupancy; a truly vacant record clears the warning', async () => {
    firstBedName = '空床';
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
    store.enterRoom(0); await settle();
    assert.equal(store.currentWard.beds[0].isOccupied, true);
    assert.equal(store.bedDetailsIssues.length, 1);
    const html = await render();
    assert.match(html, /已入住 1 床/);
    assert.match(html, /未关联床头机设备/);
    assert.match(html, /名称与入住记录不一致/);
    assert.doesNotMatch(html, /患者数据已同步/);
    store.enterRoom(1); await settle();
    assert.equal(status(), 'ready');
    assert.doesNotMatch(await render(), /名称与入住记录不一致/);
    firstOccupied = false;
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
    store.enterRoom(0); await settle();
    assert.equal(store.currentWard.beds[0].isOccupied, false);
    assert.deepEqual(store.bedDetailsIssues, []);
    assert.match(await render(), /当前病房暂无入住记录/);
    firstOccupied = true; firstBedName = '208床';
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
    store.enterRoom(1); await settle();
  });
  await test('late failure cannot replace the new room issues; exit and logout clear them', async () => {
    failSecond = true; holdSecond = true;
    const pending = store.refreshWardBedDetails();
    assert.equal(typeof releaseSecond, 'function');
    store.enterRoom(0); await settle();
    releaseSecond(); await pending;
    assert.deepEqual(store.bedDetailsIssues.map(issue => issue.bedCode), ['208']);
    store.setSceneType('nurse-station'); assert.deepEqual(store.bedDetailsIssues, []);
    store.enterRoom(0); await settle(); store.clearSessionState();
    assert.deepEqual(store.bedDetailsIssues, []);
  });
} finally { store.clearSessionState(); globalThis.fetch = originalFetch; await server.close(); }
