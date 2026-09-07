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
  // 后墙大屏高度进一步收窄，避免覆盖下方工作台屏幕。
  assert.match(overlay, /const overlayFitScaleY = kind === 'dashboard' \? 1\.08 : 1/);
});

test('护士站动态屏覆盖层按相机所在侧放到屏幕正面并保持真实宽高轴', () => {
  const overlay = areaScene.slice(
    areaScene.indexOf('private attachNurseStationTextureOverlay('),
    areaScene.indexOf('private attachNurseStationBoardDisplays('),
  );
  assert.match(
    overlay,
    /const cameraLocal = root\.worldToLocal\(\s*this\.worldFromNurseLocal\(STATION_CAM_LOCAL\.clone\(\)\),\s*\)/,
  );
  assert.match(overlay, /const frontSign = getAxisValue\(cameraLocal, depthAxis\)/);
  assert.match(overlay, /const widthAxis = axisVector\(surfaceAxes\[0\]\.axis\)/);
  assert.match(overlay, /const heightAxis = axisVector\(surfaceAxes\[1\]\.axis\)/);
  assert.match(overlay, /setFromRotationMatrix\(new THREE\.Matrix4\(\)\.makeBasis\(widthAxis, heightAxis, normal\)\)/);
});
