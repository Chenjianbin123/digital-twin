import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏缩高时同步缩放模型 Monitor_Bezel 背景', () => {
  const overlay = areaScene.slice(
    areaScene.indexOf('private attachNurseStationTextureOverlay('),
    areaScene.indexOf('private getNurseStationMeshBoundsInRoot('),
  );

  assert.match(areaScene, /private syncNurseStationDashboardBackgroundHeight\(\s*\n\s*root: THREE\.Object3D/);
  assert.match(overlay, /kind === 'dashboard'/);
  assert.match(overlay, /syncNurseStationDashboardBackgroundHeight\(\s*\n\s*root,/);
  assert.match(areaScene, /root\.traverse\(\(object\) =>/);
  assert.match(areaScene, /Monitor_Bezel/);
  assert.match(areaScene, /const geometry = mesh\.geometry\.clone\(\)/);
  assert.match(areaScene, /overlayHeight/);
});
