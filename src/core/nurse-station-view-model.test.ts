import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeArea } from './area-summary.ts';
import { buildNurseStationPatientRows } from './nurse-station-screen-data.ts';
import { buildNurseStationViewModel } from './nurse-station-view-model.ts';
import type { NormalizedSwpEvent, SwpEventSyncState } from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const READY_SYNC: SwpEventSyncState = {
  phase: 'ready',
  lastSyncedAt: '2026-09-08T08:00:00.000Z',
  error: null,
  warning: null,
};

function makeArea(roomCode: string, calling = false): TwinAreaEntity {
  return {
    areaName: `${roomCode}病区`,
    areaCode: `area-${roomCode}`,
    deptName: '心内科',
    rooms: [{
      sickroomId: roomCode,
      sickroomCode: roomCode,
      sickroomName: `${roomCode}病房`,
      deviceCode: `door-${roomCode}`,
      isOnline: true,
      beds: [{
        bedCode: `${roomCode}-1`,
        bedName: '1床',
        deviceCode: `bed-${roomCode}-1`,
        position: { x: 0, z: 0 },
        isOccupied: true,
        isOnline: true,
        isCalling: calling,
      }],
    }],
  };
}

function makeEvent(areaId: number, roomCode: string, id = `call-${areaId}`): NormalizedSwpEvent {
  return {
    id,
    source: 'swp-call',
    areaId,
    taskType: 'call',
    severity: 'critical',
    timestampMs: Date.parse('2026-09-08T08:00:00.000Z'),
    title: '患者呼叫',
    description: `${roomCode}病房 1床呼叫护士站`,
    location: {
      roomIndex: 0,
      roomCode,
      roomName: `${roomCode}病房`,
      bedCode: `${roomCode}-1`,
      bedName: '1床',
    },
    locationStatus: 'matched',
    locationLabel: `${roomCode}病房 1床`,
  };
}

function build(areaId: number, area: TwinAreaEntity, events: NormalizedSwpEvent[]) {
  return buildNurseStationViewModel({
    areaId,
    area,
    roomSummaries: summarizeArea(area.rooms),
    swpEvents: events,
    swpEventSync: READY_SYNC,
    swpResponseSync: READY_SYNC,
    inspectionSync: READY_SYNC,
    wardDataStatus: 'ready',
    wardDataSyncedAtMs: Date.parse('2026-09-08T08:00:00.000Z'),
  });
}

test('real SWP call drives the same top, KPI, room and 3D screen state', () => {
  const area = makeArea('601');
  const viewModel = build(100, area, [makeEvent(100, '601')]);
  const screenRows = buildNurseStationPatientRows(viewModel.roomSummaries, viewModel.metrics);

  assert.equal(viewModel.state.level, 'urgent');
  assert.equal(viewModel.metrics.calling, 1);
  assert.equal(viewModel.metrics.callingCount, 1);
  assert.equal(viewModel.roomSummaries[0].callingCount, 1);
  assert.equal(viewModel.roomSummaries[0].priority, 'calling');
  assert.match(screenRows[0].detail, /呼叫 1/);
  assert.equal(screenRows[0].state, 'urgent');
});

test('bed snapshot and SWP event for the same physical call are counted once', () => {
  const area = makeArea('601', true);
  const viewModel = build(100, area, [makeEvent(100, '601')]);

  assert.equal(viewModel.metrics.calling, 1);
  assert.equal(viewModel.roomSummaries[0].callingCount, 1);
});

test('switching areas rebuilds the snapshot without leaking events across areas', () => {
  const events = [makeEvent(100, '601'), makeEvent(200, '701')];
  const areaA = build(100, makeArea('601'), events);
  const areaB = build(200, makeArea('701'), events);

  assert.deepEqual(areaA.swpEvents.map(event => event.areaId), [100]);
  assert.deepEqual(areaB.swpEvents.map(event => event.areaId), [200]);
  assert.equal(areaA.metrics.calling, 1);
  assert.equal(areaB.metrics.calling, 1);
  assert.equal(areaA.roomSummaries[0].sickroomCode, '601');
  assert.equal(areaB.roomSummaries[0].sickroomCode, '701');
  assert.doesNotMatch(areaB.roomSummaries[0].statusText, /601/);
});

test('realtime label follows data freshness instead of always claiming realtime', () => {
  const area = makeArea('601');
  const ready = build(100, area, []);
  const stale = buildNurseStationViewModel({
    areaId: 100,
    area,
    roomSummaries: summarizeArea(area.rooms),
    swpEventSync: READY_SYNC,
    wardDataStatus: 'stale',
  });

  const responseError = buildNurseStationViewModel({
    areaId: 100,
    area,
    roomSummaries: summarizeArea(area.rooms),
    swpEventSync: READY_SYNC,
    swpResponseSync: { ...READY_SYNC, phase: 'error', error: '响应指标中断' },
    inspectionSync: READY_SYNC,
    wardDataStatus: 'ready',
  });

  assert.equal(ready.realtime.label, '实时数据');
  assert.equal(responseError.realtime.status, 'error');
  assert.match(responseError.realtime.detail, /响应指标/);
  assert.equal(stale.realtime.status, 'stale');
  assert.equal(stale.realtime.label, '数据已延迟');
  assert.equal(stale.state.label, '数据需复核');
});
