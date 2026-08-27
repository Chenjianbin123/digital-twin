import assert from 'node:assert/strict';
import test from 'node:test';
import * as liveDataModule from './nurse-station-live-data.ts';
import { buildNurseStationLiveData } from './nurse-station-live-data.ts';
import type { AlertTask } from './alert-workflow.ts';
import type { TwinAreaEntity } from '@/types/twin';
import type { RoomSummary } from './area-summary.ts';

function makeArea(): TwinAreaEntity {
  return {
    areaName: '心内科病区', areaCode: 'A1', deptName: '心内科',
    rooms: [{
      sickroomName: '601', sickroomCode: '601', sickroomId: '1', deviceCode: 'door-1',
      beds: [
        { bedCode: '601-1', bedName: '1床', deviceCode: 'bed-1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true, isCalling: true },
        { bedCode: '601-2', bedName: '2床', deviceCode: 'bed-2', position: { x: 1, z: 0 }, isOccupied: false, isOnline: false },
      ],
    }],
  };
}

function makeSummary(priority: RoomSummary['priority']): RoomSummary {
  return { roomIndex: 0, sickroomName: '601', sickroomCode: '601', totalBeds: 2, occupiedBeds: 1, infusingCount: 0, offlineCount: 1, callingCount: 1, envAlertLevel: 'normal', priority, accentColor: '#fff', statusText: '呼叫 1' };
}

test('derives live bed, event, environment and device metrics', () => {
  const result = buildNurseStationLiveData(makeArea(), [makeSummary('calling')]);
  assert.deepEqual({
    rooms: result.rooms,
    totalBeds: result.totalBeds,
    occupiedBeds: result.occupiedBeds,
    emptyBeds: result.emptyBeds,
    occupiedRate: result.occupiedRate,
    callingCount: result.callingCount,
    deviceTotal: result.deviceTotal,
    deviceOnline: result.deviceOnline,
    deviceHealthRate: result.deviceHealthRate,
  }, { rooms: 1, totalBeds: 2, occupiedBeds: 1, emptyBeds: 1, occupiedRate: 50, callingCount: 1, deviceTotal: 3, deviceOnline: 1, deviceHealthRate: 33 });
  assert.equal(result.priorityRooms[0].priority, 'calling');
  assert.equal(result.state.level, 'urgent');
});

test('counts active infusion beds for routine nurse rounds', () => {
  const area = makeArea();
  area.rooms[0].beds[0].isCalling = false;
  area.rooms[0].beds[0].statusBarInfo = {
    bedCode: '601-1',
    deviceCode: 'bed-1',
    status: '301',
  };

  const result = buildNurseStationLiveData(area, []);

  assert.equal(result.infusingCount, 1);
});

test('builds a current-shift handoff summary from active clinical tasks and sync state', () => {
  const builder = (liveDataModule as Record<string, unknown>).buildShiftHandoffSummary;
  assert.equal(typeof builder, 'function');
  if (typeof builder !== 'function')
    return;

  const baseTask: AlertTask = {
    id: 'task-1',
    type: 'call',
    severity: 'critical',
    status: 'pending',
    roomIndex: 0,
    roomName: '601病房',
    roomCode: '601',
    title: '床位呼叫',
    description: '601病房 1床正在呼叫',
    actionText: '进入床位',
  };
  const tasks: AlertTask[] = [
    baseTask,
    { ...baseTask, id: 'device-1', type: 'offline', severity: 'high', title: '设备离线' },
    { ...baseTask, id: 'env-1', type: 'env', severity: 'medium', bedCode: undefined, title: '病房环境预警' },
    { ...baseTask, id: 'infusion-1', type: 'infusion', severity: 'medium', title: '输液巡视' },
  ];

  assert.deepEqual(builder(tasks, { phase: 'partial', lastSyncedAt: null, error: null, warning: '部分失败' }), {
    level: 'attention',
    title: '本班需重点交接',
    items: [
      '未结束呼叫 1 项',
      '设备异常 1 项',
      '环境异常病房 1 间',
      '输液待巡视 1 床',
      '实时数据部分同步，请结合管理机或话机确认',
    ],
  });
});

test('reports a clear handoff state when there are no active tasks', () => {
  const builder = (liveDataModule as Record<string, unknown>).buildShiftHandoffSummary;
  assert.equal(typeof builder, 'function');
  if (typeof builder !== 'function')
    return;

  assert.deepEqual(builder([], { phase: 'ready', lastSyncedAt: '2026-08-25T10:00:00', error: null, warning: null }), {
    level: 'normal',
    title: '本班暂无重点交接',
    items: ['当前无未结束呼叫、设备异常、环境异常或输液巡视事项', '实时数据已同步'],
  });
});

test('does not invent device metrics for missing device codes or empty areas', () => {
  const area = { ...makeArea(), rooms: [] };
  const result = buildNurseStationLiveData(area, []);
  assert.equal(result.occupiedRate, null);
  assert.equal(result.deviceHealthRate, null);
  assert.equal(result.priorityRooms.length, 0);
});

test('counts a door terminal online only when the backend reports it online', () => {
  const unknownDoor = makeArea();
  unknownDoor.rooms[0].beds[1].isOnline = true;
  assert.equal(buildNurseStationLiveData(unknownDoor, []).deviceOnline, 2);

  const onlineDoor = makeArea();
  onlineDoor.rooms[0].isOnline = true;
  assert.equal(buildNurseStationLiveData(onlineDoor, []).deviceOnline, 2);
});

test('separates offline and low-battery devices for nurse station巡检', () => {
  const area = makeArea();
  area.rooms[0].beds[0].isCalling = false;
  area.rooms[0].beds[0].statusBarInfo = {
    bedCode: '601-1',
    deviceCode: 'bed-1',
    status: '304',
  };
  area.rooms[0].beds[1].isOccupied = true;
  area.rooms[0].beds[1].statusBarInfo = {
    bedCode: '601-2',
    deviceCode: 'bed-2',
    status: '9',
  };

  const result = buildNurseStationLiveData(area, []);

  assert.equal(result.offlineDeviceCount, 1);
  assert.equal(result.lowBatteryDeviceCount, 1);
  assert.equal(result.offlineBedCount, 2);
  assert.equal(result.state.message, '1 台设备离线，1 台设备低电量');
});
