import assert from 'node:assert/strict';
import {
  BED_DEPTH,
  BED_FOOT_Z,
  BED_HEAD_Z,
  BED_WIDTH,
  MIN_BED_CLEARANCE,
  resolveBedVisualScale,
} from '../src/core/ward-bed-geometry.ts';

assert.ok(BED_DEPTH > BED_WIDTH * 1.8, '病床长度应沿 Z 轴明显长于 X 轴宽度');
assert.ok(BED_WIDTH >= 1.4, '病床宽度需要有足够视觉存在感');
assert.ok(BED_DEPTH >= 3, '病床长度需要匹配病房空间比例');
assert.ok(BED_HEAD_Z < -0.95, '床头应贴近后墙侧');
assert.ok(BED_FOOT_Z > 1.55, '床尾应向病房中部充分延伸');
assert.ok(MIN_BED_CLEARANCE >= 1.3, '病床之间需要保留可通行间隔');
assert.ok(resolveBedVisualScale(4) >= 1.34, '四人间病床需要有更明显的视觉比例');
assert.ok(resolveBedVisualScale(6) < resolveBedVisualScale(4), '多人间应略微收敛缩放避免拥挤');
