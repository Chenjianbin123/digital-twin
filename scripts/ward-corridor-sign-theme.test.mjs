import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const previous = globalThis.document;
const draws = [];
const ctx = new Proxy({
  fillRect() { draws.push(['background', this.fillStyle]); },
  fillText(text) { draws.push([text, this.fillStyle]); },
  measureText: () => ({ width: 200 }),
  createLinearGradient: () => ({ addColorStop() {} }),
}, { get: (target, key) => key in target ? target[key] : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
try {
  const THREE = await server.ssrLoadModule('three');
  const { CorridorMarker } = await server.ssrLoadModule('/src/core/ward-corridor-markers.ts');
  const { createCorridorScreenTexture } = await server.ssrLoadModule('/src/core/hospital-scene-details.ts');
  const { AreaScene } = await server.ssrLoadModule('/src/core/area-scene.ts');
  const marker = new CorridorMarker(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  for (const dark of [false, true, false]) {
    draws.length = 0;
    marker.update('A101', undefined, true, false, dark);
    assert.ok(draws.some(([text, color]) => text === 'A101' && color === (dark ? '#ffffff' : '#17384c')),
      'theme-only changes must repaint cached marker');
    assert.ok(draws.some(([text]) => text === '门口机离线'));
    for (const mode of ['area', 'clock']) {
      draws.length = 0;
      const texture = createCorridorScreenTexture({ areaName: '测试病区', mode, theme: dark ? 'dark' : 'light' });
      assert.ok(draws.some(([text, color]) => text !== 'background' && color === (dark ? '#ffffff' : '#17384c')));
      texture.dispose();
    }
  }
  let markers = 0, displays = 0;
  AreaScene.prototype.setTheme.call({ modelKind: 'corridor', updateThemeBackground() {},
    updateCorridorMarkers() { markers++; }, refreshCorridorDisplays() { displays++; } }, 'light');
  assert.equal(markers, 1); assert.equal(displays, 1);
  marker.dispose();
}
finally { globalThis.document = previous; await server.close(); }
