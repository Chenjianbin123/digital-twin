import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏内容全出血并增加患者动态卡片高度', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.doesNotMatch(dashboard, /const SCREEN_SAFE_MARGIN/);
  assert.match(dashboard, /const columnTop = 132/);
  assert.match(dashboard, /const columnHeight = 508/);
  assert.match(dashboard, /const patientCardHeight = 72/);
  assert.match(dashboard, /index \* 84/);
});
