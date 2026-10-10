import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

const server = await createServer({ configFile: false, appType: 'custom', plugins: [vue()],
  server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': resolve('src') } },
  css: { preprocessorOptions: { scss: { additionalData: '@use "@/styles/breakpoints.scss" as *;\n@use "@/styles/dashboard.scss" as *;\n' } } },
});
try {
  const { default: Alerts } = await server.ssrLoadModule('/src/components/AlertTaskPanel.vue');
  const task = { id: 'TEST', type: 'call', source: 'swp-call', status: 'pending', severity: 'critical',
    roomIndex: -1, roomCode: '', roomName: '', title: '合成呼叫', description: '合成验证', actionText: '本机确认', canLocate: false };
  const render = props => renderToString(createSSRApp(Alerts, { tasks: [task], collapsible: true, ...props }));
  await test('corridor compact notice is a header badge rather than a full-width notice block', async () => {
    const html = await render({ compactNotice: true, dataStatus: 'warning' });
    assert.match(html, /alert-task-panel__sync-badge[^>]*[\s\S]*?>信息不完整<\/span>/);
    assert.doesNotMatch(html, /class="alert-task-panel__notice"/);
    assert.match(html, /现场情况确认是否仍有待办/);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 4);
    assert.match(html, /确认关注不代表/);
    assert.match(html, /暂无法定位/);
  });
  await test('the shared default still shows the full warning in other scenes', async () => {
    const html = await render({ dataStatus: 'warning' });
    assert.match(html, /class="alert-task-panel__notice"/);
    assert.doesNotMatch(html, /class="alert-task-panel__sync-badge"/);
  });
  await test('compact status distinguishes loading, error and stale data; ready has no badge', async () => {
    for (const [dataStatus, label] of [['loading', '更新中'], ['error', '暂未更新'], ['stale', '更新延迟']]) {
      const html = await render({ compactNotice: true, dataStatus });
      assert.match(html, new RegExp(`>${label}</span>`));
      assert.doesNotMatch(html, /class="alert-task-panel__notice"/);
    }
    assert.doesNotMatch(await render({ compactNotice: true, dataStatus: 'ready' }), /class="alert-task-panel__sync-badge"/);
  });
  await test('empty partial data never claims there are no alarms and unsupported counts stay unknown', async () => {
    const empty = await render({ compactNotice: true, dataStatus: 'warning', tasks: [] });
    assert.match(empty, /alert-task-panel__empty/);
    assert.match(empty, /现场情况确认是否仍有待办/);
    const unsupported = await render({ compactNotice: true, dataSupported: false });
    assert.match(unsupported, />暂不可用<\/span>/);
    assert.match(unsupported, /<strong[^>]*>--<\/strong>/);
  });
} finally { await server.close(); }
