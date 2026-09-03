import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const renderer = readFileSync(new URL('../src/core/plan-renderer.ts', import.meta.url), 'utf8');

test('2.5D 顶部信息条左侧展示医生护士，不展示设备编码信息', () => {
  assert.match(renderer, /drawHeaderStaffSummary/, '顶部副信息应由医护摘要绘制');
  assert.doesNotMatch(renderer, /编码 \$\{ward\.sickroomCode\}/, '顶部不应展示房间编码');
  assert.doesNotMatch(renderer, /门口机 \$\{ward\.deviceCode\}/, '顶部不应展示门口机 SN');
  assert.doesNotMatch(renderer, /IP \$\{ward\.deviceIp\}/, '顶部不应展示门口机 IP');
});

test('2.5D 顶部右侧指标卡使用统一居中布局', () => {
  assert.match(renderer, /drawHeaderMetricChip/, '顶部指标卡应使用专用居中绘制函数');
  assert.match(renderer, /ctx\.textAlign = 'center'[\s\S]*ctx\.textBaseline = 'middle'/, '指标数值和标签应居中对齐');
});
