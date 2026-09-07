import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('后墙动态屏隐藏 GLB 自带的静态白板与患者状态内容', () => {
  const helper = source.slice(
    source.indexOf('private hideNurseStationPlaceholderMaterialsOnMesh('),
    source.indexOf('private hideNurseStationStaticBoardContent('),
  );
  assert.match(helper, /Nursing_Board_Title/);
  assert.match(helper, /Whiteboard_Ink/);
  assert.match(helper, /Patient_Status_Bar_02/);
  assert.match(helper, /白偏蓝/);
});

console.log('Nurse-station rear static-content checks passed.');
