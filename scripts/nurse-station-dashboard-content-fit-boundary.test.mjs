import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏内容使用安全边界并增加患者动态卡片高度', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.doesNotMatch(dashboard, /const SCREEN_SAFE_MARGIN/);
  assert.match(dashboard, /const headerHeight = 116/);
  assert.match(dashboard, /const columnTop = headerHeight/);
  assert.match(dashboard, /const columnHeight = 640 - headerHeight - dashboardPadding/);
  assert.match(dashboard, /const patientCardHeight = 84/);
  assert.match(dashboard, /const patientCardGap = 13/);
  assert.match(dashboard, /index \* \(patientCardHeight \+ patientCardGap\)/);
});
