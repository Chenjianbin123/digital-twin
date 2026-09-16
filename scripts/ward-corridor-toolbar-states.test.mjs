import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: Toolbar } = await server.ssrLoadModule('/src/components/WardCorridorToolbar.vue');
  const { WardCorridorLayout } = await server.ssrLoadModule('/src/core/ward-corridor-layout.ts');
  const doors = Array.from({ length: 10 }, (_, i) => `门${i + 1}`);
  for (const count of [0, 1, 2, 10, 11]) {
    const rooms = Array.from({ length: count }, (_, i) => ({ sickroomCode: String(i), sickroomName: `测试${i}`, isOnline: false }));
    const layout = new WardCorridorLayout(doors, doors.map((_, i) => `门口机${i + 1}`)).resolve(rooms);
    const html = await renderToString(createSSRApp(Toolbar, {
      area: { rooms }, summaries: [], layout, focusedRoomIndex: -1, panelsVisible: false,
    }));
    assert.ok(html.includes(`已接入 ${count} 间病房`));
    assert.ok(html.includes('分组示意，非实际位置'));
    if (!count) assert.ok(html.includes('当前病区暂无已接入门口机'));
    if (count === 1) {
      assert.ok(html.includes('定位门口屏'));
      assert.ok(html.includes('进入病房'));
      assert.ok(html.includes('门口机离线'));
      assert.ok(!html.includes('收起房号'));
      assert.ok(!html.includes('<nav'));
    }
    assert.equal(html.includes('下一组'), count > 10);
  }
}
finally { await server.close(); }
