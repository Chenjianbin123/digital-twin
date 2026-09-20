import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const previous = globalThis.document;
const draws = [];
const ctx = {
  fillRect() {}, strokeRect() {},
  measureText(text) { return { width: [...text].length * parseFloat(this.font.split(' ')[1]) * 0.65 }; },
  fillText(text, x, y, ...extra) { draws.push({ text, x, y, extra, font: this.font, width: this.measureText(text).width }); },
};
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
try {
  const { createCorridorSignTexture } = await server.ssrLoadModule('/src/core/corridor-sign-texture.ts');
  for (const theme of ['light', 'dark']) {
    for (const aspect of [2.2, 4, 6]) {
      for (const areaName of ['骨科病区', '骨科与运动医学康复联合病区', '  ']) {
        draws.length = 0;
        const texture = createCorridorSignTexture({ mode: 'area', theme, aspect, areaName });
        assert.ok(Math.abs(texture.image.width / texture.image.height - aspect) < 0.02);
        assert.equal(draws.length, 1, 'no duplicate department subtitle');
        const title = draws[0];
        assert.equal(title.text, areaName.trim() || '病区');
        assert.equal(title.extra.length, 0, 'never use fillText maxWidth to squeeze glyphs');
        assert.ok(title.x - title.width / 2 > 0 && title.x + title.width / 2 < texture.image.width);
        texture.dispose();
      }
      draws.length = 0;
      const texture = createCorridorSignTexture({ mode: 'clock', theme, aspect, areaName: '' });
      assert.match(draws[0].text, /^\d{2}:\d{2}$/);
      assert.match(draws[1].text, /^\d{2}$/);
      assert.equal(draws[0].y, draws[1].y, 'seconds share the main baseline');
      assert.ok(parseFloat(draws[1].font.split(' ')[1]) < parseFloat(draws[0].font.split(' ')[1]));
      assert.ok(draws[1].x > draws[0].x + draws[0].width);
      texture.dispose();
    }
  }
}
finally { globalThis.document = previous; await server.close(); }
