import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeArea } from './area-summary.ts';
import { buildNurseStationPatientRows } from './nurse-station-screen-data.ts';
import { buildNurseStationViewModel } from './nurse-station-view-model.ts';
import type { NormalizedSwpEvent, SwpEventSyncState } from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';
import { ENV_STALE_AFTER_MS } from './environment-state.ts';

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
    nowMs: Date.parse(READY_SYNC.lastSyncedAt!),
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

test('environment means and warning counts expire together while previous anomalies remain unverified', () => {
  const area = makeArea('601');
  const receivedAt = Date.parse(READY_SYNC.lastSyncedAt!);
  area.rooms[0].doorEnvData = { temp: '32℃', relativeHumid: '80%' };
  area.rooms[0].envSync = { lastSuccessAt: receivedAt, failed: false };
  const snapshot = (nowMs: number, source: 'remote' | 'mock' | 'database' = 'remote') => {
    const sync = { ...READY_SYNC, lastSyncedAt: new Date(nowMs).toISOString() };
    return buildNurseStationViewModel({
      area, dataSource: source, nowMs, roomSummaries: summarizeArea(area.rooms),
      wardDataStatus: 'ready', wardDataSyncedAtMs: nowMs,
      swpEventSync: sync, swpResponseSync: sync, inspectionSync: sync,
      alertTasks: [{ id: 'env:601', type: 'env', severity: 'critical', status: 'pending',
        roomIndex: 0, roomName: '601病房', roomCode: '601', title: '环境异常',
        description: '温度过高', actionText: '定位病房' }],
    });
  };
  const current = snapshot(receivedAt);
  assert.equal(current.environment.temperature, 32);
  assert.equal(current.metrics.envWarnings, 1);
  const stale = snapshot(receivedAt + ENV_STALE_AFTER_MS);
  assert.equal(stale.environment.temperature, null);
  assert.equal(stale.metrics.envWarnings, 0);
  assert.equal(stale.environment.pendingRooms, 1);
  assert.equal(stale.environment.unverifiedWarningRooms, 1);
  assert.match(stale.roomSummaries[0].statusText, /环境异常待核实/);
  assert.equal(stale.alertTasks[0].title, '环境异常待核实');
  assert.equal(stale.alertTasks[0].retained, true);
  assert.match(stale.shiftHandoff.items.join(' '), /环境异常待核实 1 间/);
  assert.doesNotMatch(stale.shiftHandoff.items.join(' '), /环境异常病房/);
  assert.equal(stale.state.level, 'attention');
  assert.notEqual(stale.state.label, '运行正常');
  area.rooms[0].envSync = { lastSuccessAt: receivedAt, failed: true };
  assert.equal(snapshot(receivedAt).environment.temperature, null);
  delete area.rooms[0].envSync;
  assert.equal(snapshot(receivedAt).environment.validRooms, 0);
  assert.equal(snapshot(receivedAt, 'mock').environment.validRooms, 1);
  assert.equal(snapshot(receivedAt, 'database').environment.temperature, 32);
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

  assert.equal(ready.realtime.label, '信息已更新');
  assert.equal(responseError.realtime.status, 'error');
  assert.match(responseError.realtime.detail, /响应指标/);
  assert.equal(stale.realtime.status, 'stale');
  assert.equal(stale.realtime.label, '信息更新延迟');
  assert.equal(stale.state.label, '信息需核对');
});

test('retained records stay visible without claiming a current call or vital alarm', () => {
  const area = makeArea('601');
  const events = [makeEvent(100, '601'), { ...makeEvent(100, '601', 'vital-1'), taskType: 'vital' as const }]
    .map(event => ({ ...event, retained: true }));
  const vm = buildNurseStationViewModel({ areaId: 100, area, roomSummaries: summarizeArea(area.rooms),
    swpEvents: events, swpEventSync: { ...READY_SYNC, phase: 'partial' },
    alertTasks: events.map(event => ({ id: event.id, source: event.source, type: event.taskType, retained: true,
      roomCode: '601', roomIndex: 0, roomName: '601病房', severity: 'critical', status: 'pending', title: event.title,
      description: '', startedAt: READY_SYNC.lastSyncedAt!, canLocate: false, actionText: '定位' })),
  });
  assert.equal(vm.metrics.calling, 0);
  assert.equal(vm.metrics.vitalWarnings, 0);
  assert.equal(vm.roomSummaries[0].callingCount, 0);
  assert.equal(vm.swpEvents.length, 2);
  assert.equal(vm.alertTasks.length, 2);
  assert.equal(vm.state.level, 'attention');
  assert.match(vm.state.label, /状态待确认/);
  assert.match(vm.shiftHandoff.items.join(' '), /2 项记录状态待确认/);
  assert.doesNotMatch(vm.shiftHandoff.items.join(' '), /呼叫待办|生命体征预警/);
  assert.equal(vm.shiftHandoff.title, '交班信息需核对');
});
