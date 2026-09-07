import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const chart = await readFile(
  new URL('../src/components/dashboard/NurseStationMetricChart.vue', import.meta.url),
  'utf8',
).catch(() => '');
const panel = await readFile(
  new URL('../src/components/NurseStationPanel.vue', import.meta.url),
  'utf8',
);

test('护士站指标图使用 ECharts 并支持空数据与尺寸自适应', () => {
  assert.match(chart, /from ['"]echarts\/core['"]/);
  assert.match(chart, /BarChart/);
  assert.match(chart, /scaleByKey/);
  assert.match(chart, /barCategoryGap/);
  assert.match(chart, /borderRadius/);
  assert.match(chart, /axisLabel:\s*\{\s*show:\s*false/);
  assert.match(chart, /height: 140px/);
  assert.match(chart, /fontSize: 14/);
  assert.match(chart, /ResizeObserver/);
  assert.match(chart, /暂无可用指标/);
  assert.match(chart, /\.dispose\(\)/);
  assert.match(chart, /props\.kpis/);
});

test('护士站面板把实时核心指标传给 ECharts 图表', () => {
  assert.match(panel, /NurseStationMetricChart/);
  assert.match(panel, /:kpis="stationKpis"/);
});
