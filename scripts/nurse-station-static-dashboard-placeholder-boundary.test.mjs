import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏会隐藏模型内置的静态大字占位内容', () => {
  const hideStaticContent = areaScene.slice(
    areaScene.indexOf('private hideNurseStationStaticBoardContent('),
    areaScene.indexOf('private refreshNurseStationBoardDisplays('),
  );
  for (const name of [
    'Detail_Header_Accent',
    'Detail_Header_Center',
    'Detail_Header_Left',
    'Detail_Header_Left_Text',
    'Detail_Header_Right',
    'Detail_Header_Right_Text',
    'Detail_Header_Subtitle',
    'Detail_Header_Title',
  ]) {
    assert.match(hideStaticContent, new RegExp(`'${name}'`));
  }
});
