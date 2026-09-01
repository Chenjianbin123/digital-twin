import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站顶部主屏覆盖层使用轻微过扫描铺满显示区域', () => {
  assert.match(areaScene, /const overlayFitScaleX = kind === 'dashboard' \? 1\.24 : 1/);
  assert.match(areaScene, /const overlayFitScaleY = kind === 'dashboard' \? 1\.08 : 1/);
  assert.match(areaScene, /surfaceAxes\[0\]\.size \* overlayFitScaleX/);
  assert.match(areaScene, /surfaceAxes\[1\]\.size \* overlayFitScaleY/);
  assert.match(areaScene, /const DEBUG_DASHBOARD_SCREEN_BORDER = false/);
  assert.match(areaScene, /color: 0xff3344/);
});
