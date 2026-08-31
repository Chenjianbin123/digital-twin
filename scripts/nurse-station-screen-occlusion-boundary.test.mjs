import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站屏幕模板参与深度测试且不改变现有屏幕尺寸', () => {
  const overlay = areaScene.slice(
    areaScene.indexOf('private attachNurseStationTextureOverlay('),
    areaScene.indexOf('private attachNurseStationBoardDisplays('),
  );
  assert.match(overlay, /map: texture/);
  assert.match(overlay, /depthTest: true/);
  assert.match(overlay, /depthWrite: false/);
  assert.match(overlay, /const overlayFitScaleX = kind === 'dashboard' \? 1\.24 : 1/);
  assert.match(overlay, /const overlayFitScaleY = kind === 'dashboard' \? 1\.42 : 1/);
});
