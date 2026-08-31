import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站屏幕模板使用统一科技风清晰度与背景装饰', () => {
  assert.match(areaScene, /private drawTechGrid\(/);
  assert.match(areaScene, /ctx\.shadowBlur/);
  assert.match(areaScene, /texture\.minFilter = THREE\.LinearFilter/);
  assert.match(areaScene, /const CANVAS_SCALE = 2/);
  assert.match(areaScene, /drawTechGrid\(ctx/);
});
