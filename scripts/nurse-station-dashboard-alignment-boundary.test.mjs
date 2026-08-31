import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏三栏使用安全内边距、统一间距并裁剪内容', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.doesNotMatch(dashboard, /const SCREEN_SAFE_MARGIN/);
  assert.match(dashboard, /const dashboardPadding = 22/);
  assert.match(dashboard, /const columnGap = 16/);
  assert.match(dashboard, /const columnWidth = \(1200 - dashboardPadding \* 2 - columnGap \* 2\) \/ 3/);
  assert.match(dashboard, /const leftX = dashboardPadding/);
  assert.match(dashboard, /const centerX = leftX \+ columnWidth \+ columnGap/);
  assert.match(dashboard, /ctx\.save\(\)[\s\S]*?ctx\.clip\(\)[\s\S]*?ctx\.restore\(\)/);
});
