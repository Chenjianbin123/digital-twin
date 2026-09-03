import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/WardScene3D.vue', import.meta.url), 'utf8');

test('病房内场景不展示底部鼠标操作提示条', () => {
  assert.doesNotMatch(source, /class="ward-scene-3d__hint"/, '不应渲染底部操作提示 footer');
  assert.doesNotMatch(source, /ward-scene-3d__hint-key/, '不应保留提示条按键样式类');
  assert.doesNotMatch(source, /ward-scene-3d__hint-div/, '不应保留提示条分割线样式类');
  assert.doesNotMatch(source, /左键|滚轮|右键|单击|旋转|缩放|平移|选床/, '不应展示教学类操作文案');
});
