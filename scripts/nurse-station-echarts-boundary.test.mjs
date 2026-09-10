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

test('护士站指标面板只对有真实分母的指标展示比例', () => {
  assert.doesNotMatch(chart, /echarts/);
  assert.doesNotMatch(chart, /scaleByKey/);
  assert.match(chart, /percent\?: number \| null/);
  assert.match(chart, /role="meter"/);
  assert.match(chart, /aria-valuemax="100"/);
  assert.match(chart, /clampedPercent/);
  assert.match(chart, /暂无可用指标/);
  assert.match(chart, /props\.kpis/);
});

test('护士站面板传入真实比例和统一的新鲜度状态', () => {
  assert.match(panel, /NurseStationMetricChart/);
  assert.match(panel, /:kpis="stationKpis"/);
  assert.match(panel, /:realtime-status="viewModel\.realtime"/);
  assert.match(panel, /percent: occupancyRate\.value/);
  assert.match(panel, /percent: metrics\.value\.deviceHealthRate/);
});
