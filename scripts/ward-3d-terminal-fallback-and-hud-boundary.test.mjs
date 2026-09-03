import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const texture = readFileSync(new URL('../src/core/template/bed-terminal-texture.ts', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/components/WardScene3D.vue', import.meta.url), 'utf8');

test('3D 床头屏有明确加载、无模板、失败兜底文案', () => {
  assert.match(texture, /正在加载床头屏/);
  assert.match(texture, /暂无床头模板/);
  assert.match(texture, /床头屏模板加载失败/);
  assert.match(texture, /暂无患者信息/);
});

test('病房内 3D 不再展示顶部床位总览 HUD', () => {
  assert.doesNotMatch(hud, /ward-scene-3d__hud/);
  assert.doesNotMatch(hud, /SMART WARD · 床位总览/);
  assert.doesNotMatch(hud, /异常状态/);
  assert.doesNotMatch(hud, /ward-scene-3d__sn/);
  assert.doesNotMatch(hud, /SN \{\{ ward\.deviceCode \}\}/);
});
