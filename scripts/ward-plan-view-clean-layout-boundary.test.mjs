import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const renderer = readFileSync(new URL('../src/core/plan-renderer.ts', import.meta.url), 'utf8');

test('2.5D 病房总览为现场大屏预留顶部与底部操作区', () => {
  assert.match(renderer, /topChromeReserve/, '应避开平台页头和病区选择区域');
  assert.match(renderer, /bottomNavReserve/, '应避开底部场景导航和面板按钮区域');
  assert.doesNotMatch(renderer, /this\.drawFooter\(/, '不应再绘制会被底部导航遮挡的操作说明');
});

test('2.5D 床位卡片只展示核心护理信息，避免内容堆叠', () => {
  assert.match(renderer, /drawCompactBedMeta/, '床位卡片应使用紧凑患者信息行');
  assert.match(renderer, /drawCompactStaffChips/, '床位卡片应使用紧凑医护标签');
  assert.doesNotMatch(renderer, /ctx\.fillText\(`SN \$\{bed\.deviceCode\}`/, '床卡底部不应重复展示床头屏 SN');
});
