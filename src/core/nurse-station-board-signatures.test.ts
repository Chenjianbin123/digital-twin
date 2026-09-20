import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReferenceBoardSignatures } from './nurse-station-board-signatures.ts';
import { buildNurseStationViewModel } from './nurse-station-view-model.ts';
import { summarizeArea } from './area-summary.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

function fixture() {
  const area: TwinAreaEntity = { areaName: '测试病区', areaCode: 'T', deptName: '测试', rooms: [{
    sickroomId: 'R', sickroomCode: 'R', sickroomName: '测试病房', deviceCode: 'DOOR-R', beds: [{
      bedCode: 'B', bedName: '1床', deviceCode: 'B', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true,
    }],
  }] };
  const ready = { phase: 'ready' as const, lastSyncedAt: new Date(60000).toISOString(), error: null, warning: null };
  const vm = buildNurseStationViewModel({ area, roomSummaries: summarizeArea(area.rooms), wardDataStatus: 'ready',
    wardDataSyncedAtMs: 60000, swpEventSync: ready, swpResponseSync: ready, inspectionSync: ready });
  return { viewModel: vm, metrics: vm.metrics, summaries: vm.roomSummaries, areaName: area.areaName, darkTheme: false };
}

test('identical data and new sync timestamps do not repaint visible boards', () => {
  const input = fixture();
  const before = buildReferenceBoardSignatures(input, 60500);
  input.viewModel.realtime.syncedAt = new Date(65000).toISOString();
  for (const item of input.viewModel.dataFreshnessItems) item.syncedAt = new Date(65000).toISOString();
  assert.deepEqual(buildReferenceBoardSignatures(input, 60900), before);
});

test('second ticks only affect clock; minute ticks also update workstation headings', () => {
  const input = fixture();
  const first = buildReferenceBoardSignatures(input, 60500);
  const second = buildReferenceBoardSignatures(input, 61500);
  assert.deepEqual(Object.keys(first).filter(key => first[key as keyof typeof first] !== second[key as keyof typeof first]), ['clock']);
  const minute = buildReferenceBoardSignatures(input, 120500);
  assert.equal(first.dashboard, minute.dashboard);
  for (const key of ['taskQueue', 'wardStatus', 'bedMonitor', 'deviceHealth'] as const) assert.notEqual(first[key], minute[key]);
});

test('call changes repaint relevant boards but not bed and device metrics', () => {
  const input = fixture();
  const before = buildReferenceBoardSignatures(input, 60500);
  input.metrics.callingCount = 1;
  Object.assign(input.summaries[0], { priority: 'calling', statusText: '呼叫 1', accentColor: '#E91E63' });
  const after = buildReferenceBoardSignatures(input, 60500);
  for (const key of ['dashboard', 'taskQueue', 'wardStatus'] as const) assert.notEqual(before[key], after[key]);
  for (const key of ['bedMonitor', 'deviceHealth', 'clock'] as const) assert.equal(before[key], after[key]);
});

test('source availability, area name, theme, occupancy and device changes invalidate visible fields', () => {
  const input = fixture();
  const before = buildReferenceBoardSignatures(input, 60500);
  const events = input.viewModel.dataFreshnessItems.find(item => item.key === 'events')!;
  events.status = 'loading'; events.syncedAt = null;
  assert.notEqual(before.dashboard, buildReferenceBoardSignatures(input, 60500).dashboard);
  input.areaName = '另一个病区';
  const renamed = buildReferenceBoardSignatures(input, 60500);
  input.darkTheme = true;
  const themed = buildReferenceBoardSignatures(input, 60500);
  assert.notEqual(renamed.dashboard, themed.dashboard);
  assert.equal(renamed.clock, themed.clock);
  input.metrics.occupiedBeds = 0; input.metrics.deviceHealthRate = 0;
  const metrics = buildReferenceBoardSignatures(input, 60500);
  assert.notEqual(themed.bedMonitor, metrics.bedMonitor);
  assert.notEqual(themed.deviceHealth, metrics.deviceHealth);
});
