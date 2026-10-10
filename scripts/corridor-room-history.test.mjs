import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

// 正式 store 与组件的合成验证，不访问业务接口或本机登录信息。
const server = await createServer({ configFile: false, appType: 'custom', plugins: [vue()],
  server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': resolve('src') } },
  define: { 'import.meta.env.VITE_DATA_SOURCE': '"remote"' },
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Unexpected network request in synthetic test'); };
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
const { resolveHistoryRoom } = await server.ssrLoadModule('/src/core/corridor-room-browser.ts');
const { default: History } = await server.ssrLoadModule('/src/components/StatusHistory.vue');
setActivePinia(createPinia());
const store = useTwinStore();
const area = { areaCode: 'TEST', areaName: '合成病区', deptName: '合成科室', rooms: [
  { sickroomCode: 'R1', sickroomName: '101房', sickroomId: 'ID1', deviceCode: 'D1', beds: [
    { bedCode: 'B1', bedName: '01床', deviceCode: 'BD1', isOnline: true, isOccupied: false, position: { x: 0, z: 0 } },
  ] },
] };
try {
  store.area = area;
  store.selectedAreaId = 7;
  await test('new room-only history captures its area scope and remains locatable after refresh/reorder', () => {
    store.pushHistory({ category: 'env', roomCode: 'R1', bedCode: '', bedName: '', roomName: '旧名字', label: '环境预警' });
    assert.equal(store.statusHistory[0].areaCode, 'TEST');
    assert.equal(resolveHistoryRoom(store.statusHistory[0], area), 0);
    assert.equal(resolveHistoryRoom(store.statusHistory[0], { ...area, areaCode: 'OTHER' }), null);
  });
  await test('normalized source events retain location and unmatched records remain unlocatable', () => {
    const event = { id: 'TEST-E1', source: 'swp-alarm', areaId: 7, taskType: 'infusion', severity: 'high', timestampMs: 1,
      title: '合成输液事件', description: '', locationStatus: 'matched', locationLabel: '101房',
      location: { roomCode: 'R1', roomName: '101房', roomIndex: 0, bedCode: 'B1', bedName: '01床' } };
    assert.equal(store.applySwpEventSnapshot(7, { events: [event] }), true);
    const located = store.statusHistory.find(item => item.label === event.title);
    assert.equal(located.roomCode, 'R1');
    assert.equal(resolveHistoryRoom(located, area), 0);
    store.applySwpEventSnapshot(7, { events: [event, { ...event, id: 'TEST-E2', title: '未关联合成事件', location: null, locationStatus: 'missing-identifiers' }] });
    const missing = store.statusHistory.find(item => item.label === '未关联合成事件');
    assert.equal(missing.canLocate, false);
    assert.equal(resolveHistoryRoom(missing, area), null);
  });
  await test('history browsing is opt-in and does not add controls to other scenes', async () => {
    const plain = await renderToString(createSSRApp(History, { history: store.statusHistory }));
    assert.doesNotMatch(plain, /事件类别|定位病房|暂无法定位/);
    const corridor = await renderToString(createSSRApp(History, { history: store.statusHistory, area, browsable: true, collapsible: true }));
    assert.match(corridor, /事件类别/);
    assert.match(corridor, /定位病房：101房/);
    assert.match(corridor, /暂无法定位/);
  });
  await test('legacy history stays readable but cannot acquire a guessed target', async () => {
    const legacy = { id: 'OLD', time: '10:00:00', category: 'call', bedCode: 'B1', bedName: '01床', roomName: '101房', label: '旧记录' };
    const html = await renderToString(createSSRApp(History, { history: [legacy], area, browsable: true }));
    assert.match(html, /旧记录/);
    assert.match(html, /暂无法定位/);
    assert.doesNotMatch(html, /aria-label="定位病房/);
  });
} finally {
  store.clearSessionState();
  globalThis.fetch = originalFetch;
  await server.close();
}
