import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏三栏从屏幕边缘开始并使用统一间距', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.doesNotMatch(dashboard, /const SCREEN_SAFE_MARGIN/);
  assert.doesNotMatch(dashboard, /ctx\.clip\(\)/);
  assert.match(dashboard, /const columnWidth = \(1200 - columnGap \* 2\) \/ 3/);
  assert.match(dashboard, /const leftX = 0/);
  assert.match(dashboard, /const centerX =/);
});
