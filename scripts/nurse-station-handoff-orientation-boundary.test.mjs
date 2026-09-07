import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护理交班覆盖层只修正自身的 180 度纹理方向', () => {
  const overlay = areaScene.slice(
    areaScene.indexOf('private attachNurseStationTextureOverlay('),
    areaScene.indexOf('private getNurseStationMeshBoundsInRoot('),
  );

  // PlaneGeometry 的白板高度轴与 Canvas 原点方向相反，护理交班不能沿用其它屏幕的 flipY=true。
  assert.match(overlay, /texture\.flipY = kind === 'whiteboard' \? false : true/);
  // 白板模型的左右轴也反向，需仅对护理交班做水平镜像；不得影响走廊屏等其它模板。
  assert.match(
    overlay,
    /if \(kind === 'whiteboard'\)\s*\{\s*texture\.wrapS = THREE\.RepeatWrapping;\s*texture\.repeat\.x = -1;\s*texture\.offset\.x = 1;/s,
  );
});

console.log('Nurse-station handoff orientation checks passed.');
