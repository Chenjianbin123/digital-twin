import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalImage = globalThis.Image;
const originalDocument = globalThis.document;
let broken = true;
let draws = 0;
globalThis.Image = class {
  set src(value) { queueMicrotask(() => broken ? this.onerror?.() : this.onload?.()); }
};
const context = new Proxy({ measureText: () => ({ width: 10 }), drawImage: () => { draws++; } }, {
  get: (target, key) => key in target ? target[key] : () => {},
});
globalThis.document = { createElement: () => ({ getContext: () => context }) };
try {
  const { renderDoorTerminalTexture } = await server.ssrLoadModule('/src/core/template/door-terminal-texture.ts');
  const { WardCorridorScreenCache } = await server.ssrLoadModule('/src/core/ward-corridor-screen-cache.ts');
  const room = { sickroomCode: 'TEST', sickroomName: '测试房', beds: [], director: '1' };
  const template = { width: 1920, height: 1080, background: '#fff', nodes: [{ type: 'img', src: '/test-template.png', width: 1920, height: 1080 }] };
  const cache = new WardCorridorScreenCache();
  let applied = 0;
  const update = () => cache.update('door', 'unchanged', () => renderDoorTerminalTexture(room, {}, template, { requireTemplateImages: true }), texture => { applied++; texture.dispose(); });
  await assert.rejects(update(), /模板图片/);
  assert.equal(applied, 0, 'failed template must not replace a valid screen');
  broken = false;
  await update();
  assert.equal(applied, 1, 'same room data retries after image recovery');
  assert.ok(draws > 0, 'recovered image is drawn');
  await update();
  assert.equal(applied, 1, 'successful screen remains cached');
  broken = true;
  const changed = () => cache.update('door', 'changed', () => renderDoorTerminalTexture(room, {}, template, { requireTemplateImages: true }), texture => { applied++; texture.dispose(); });
  await assert.rejects(changed(), /模板图片/);
  assert.equal(applied, 1, 'failed refresh preserves the previous successful screen');
  broken = false;
  await changed();
  assert.equal(applied, 2);
}
finally {
  globalThis.Image = originalImage;
  globalThis.document = originalDocument;
  await server.close();
}
