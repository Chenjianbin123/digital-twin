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
    marker.update('A101', undefined, false, false, dark);
    marker.update('A101', undefined, true, false, dark);
    assert.ok(draws.some(([text, color]) => text === 'A101' && color === '#294c60'),
      'physical room signs keep their colors in both dashboard themes');
    assert.ok(draws.some(([text]) => text === '门口机离线'));
    for (const mode of ['area', 'clock']) {
      draws.length = 0;
      const texture = createCorridorScreenTexture({ areaName: '测试病区', mode, theme: dark ? 'dark' : 'light' });
      assert.ok(draws.some(([text, color]) => text !== 'background' && color === (dark ? '#e8f0f3' : '#294c60')));
      assert.ok(draws.some(([text, color]) => text === 'background' && color === (dark ? '#20343f' : '#edf3f4')),
        'area and clock must use the same theme surface');
      texture.dispose();
    }
  }
  draws.length = 0;
  marker.update('A101', { statusText: '3/3 在床', priority: 'normal' }, false, false);
  assert.deepEqual(draws.filter(([text]) => text !== 'background').map(([text]) => text), ['A101']);
  draws.length = 0;
  marker.update('A101', { statusText: '3/3 在床', priority: 'normal' }, false, false);
  assert.equal(draws.length, 0, 'unchanged room signs must reuse their texture');
  draws.length = 0;
  marker.update('A101', { statusText: '呼叫中', priority: 'calling' }, false, false);
  assert.ok(draws.some(([text]) => text === '呼叫中'));
  let markers = 0, displays = 0;
  AreaScene.prototype.setTheme.call({ modelKind: 'corridor', updateThemeBackground() {}, corridorTheme() {},
    updateCorridorMarkers() { markers++; }, refreshCorridorDisplays() { displays++; } }, 'light');
  assert.equal(markers, 1); assert.equal(displays, 1);
  marker.dispose();
}
finally { globalThis.document = previous; await server.close(); }
