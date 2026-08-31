import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏模板使用整张 Canvas 背景并裁剪内容区域', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.match(dashboard, /ctx\.fillRect\(0, 0, 1200, 640\)/);
  assert.doesNotMatch(dashboard, /const SCREEN_SAFE_MARGIN/);
  assert.match(dashboard, /const dashboardPadding = 22/);
  assert.match(dashboard, /const columnWidth = \(1200 - dashboardPadding \* 2 - columnGap \* 2\) \/ 3/);
  assert.match(dashboard, /const leftX = dashboardPadding/);
  assert.match(dashboard, /ctx\.clip\(\)/);
});
