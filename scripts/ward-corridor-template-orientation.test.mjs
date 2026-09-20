import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { corridorTemplateRoom } = await server.ssrLoadModule('/src/core/ward-corridor-screens.ts');
  const { getDoorTerminalScreenLayout } = await server.ssrLoadModule('/src/core/template/door-terminal-texture.ts');
  for (const director of [undefined, '0', '1']) {
    const room = { director, sickroomName: '测试房', beds: [] };
    for (const [width, height, horizontal] of [[1920, 1080, true], [1080, 1920, false], [800, 800, true]]) {
      const template = { width, height, nodes: [] };
      const resolved = corridorTemplateRoom(room, template);
      assert.equal(getDoorTerminalScreenLayout(resolved, template).isHorizontal, horizontal);
      assert.equal(room.director, director, 'do not mutate API data or other scene directions');
    }
  }
  for (const [width, height] of [[0, 100], [100, -1], [NaN, 100], [100, Infinity]])
    assert.throws(() => corridorTemplateRoom({}, { width, height }), /宽高无效/);
}
finally { await server.close(); }
