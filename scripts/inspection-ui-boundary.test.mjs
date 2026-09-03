import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const nurseStation = fs.readFileSync(
  new URL('../src/components/NurseStationPanel.vue', import.meta.url),
  'utf8',
);
const areaPanel = fs.readFileSync(
  new URL('../src/components/AreaInfoPanel.vue', import.meta.url),
  'utf8',
);
const wardPanel = fs.readFileSync(
  new URL('../src/components/WardInfoPanel.vue', import.meta.url),
  'utf8',
);
const alertPanel = fs.readFileSync(
  new URL('../src/components/AlertTaskPanel.vue', import.meta.url),
  'utf8',
);

test('nurse station exposes a concise real inspection overview', () => {
  assert.match(nurseStation, /inspectionRoomSummaries/);
  assert.match(nurseStation, /巡视总览/);
  assert.match(nurseStation, /巡视超时/);
  assert.match(nurseStation, /数据同步/);
});

test('corridor room cards expose latest inspection status', () => {
  assert.match(areaPanel, /inspectionRoomSummaries/);
  assert.match(areaPanel, /最近巡视/);
  assert.match(areaPanel, /暂无巡视记录/);
});

test('ward details show the latest three real inspection records', () => {
  assert.match(wardPanel, /inspectionSummary/);
  assert.match(wardPanel, /最近巡视记录/);
  assert.match(wardPanel, /slice\(0, 3\)/);
});

test('inspection alerts remain source-managed location-only tasks', () => {
  assert.match(alertPanel, /swp-inspection/);
  assert.match(alertPanel, /巡视超时/);
  assert.doesNotMatch(alertPanel, /完成巡视/);
});
