import assert from 'node:assert/strict';
import test from 'node:test';
import type { RoomSummary } from './area-summary.ts';
import type { NurseStationLiveData } from './nurse-station-live-data.ts';
import {
  buildNurseStationHandoffRows,
  buildNurseStationPatientRows,
} from './nurse-station-screen-data.ts';

function makeSummary(
  overrides: Partial<RoomSummary> & Pick<RoomSummary, 'sickroomName' | 'priority'>,
): RoomSummary {
  const { sickroomName, priority, ...rest } = overrides;
  return {
    roomIndex: 0,
    sickroomName,
    sickroomCode: sickroomName,
    totalBeds: 4,
    occupiedBeds: 2,
    infusingCount: 0,
    offlineCount: 0,
    lowBatteryCount: 0,
    callingCount: 0,
    envAlertLevel: 'normal',
    priority,
    accentColor: '#4FC3F7',
    statusText: '2/4 在床',
    ...rest,
  };
}

function makeLiveData(overrides: Partial<NurseStationLiveData> = {}): NurseStationLiveData {
  return {
    rooms: 3,
    totalBeds: 12,
    occupiedBeds: 7,
    emptyBeds: 5,
    occupiedRate: 58,
    callingCount: 2,
    infusingCount: 1,
    offlineBedCount: 0,
    offlineDeviceCount: 0,
    lowBatteryDeviceCount: 0,
    envWarningCount: 0,
    deviceTotal: 12,
    deviceOnline: 12,
    deviceHealthRate: 100,
    priorityRooms: [],
    patientBeds: [],
    state: {
      level: 'urgent',
      label: '紧急响应',
      message: '2 床正在呼叫，请优先处置',
    },
    ...overrides,
  };
}

test('builds handoff rows from room summaries and prioritizes active care items', () => {
  const summaries = [
    makeSummary({
      roomIndex: 1,
      sickroomName: '602',
      priority: 'normal',
      occupiedBeds: 1,
    }),
    makeSummary({
      roomIndex: 0,
      sickroomName: '601',
      priority: 'calling',
      callingCount: 2,
      infusingCount: 1,
      statusText: '呼叫 2 · 输液 1',
      accentColor: '#E91E63',
    }),
    makeSummary({
      roomIndex: 2,
      sickroomName: '603',
      priority: 'warning',
      envAlertLevel: 'warning',
      statusText: '环境预警',
      accentColor: '#FFB74D',
    }),
  ];

  const rows = buildNurseStationHandoffRows(summaries, makeLiveData());

  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.roomName, '601');
  assert.match(rows[0]?.detail ?? '', /呼叫 2/);
  assert.equal(rows[0]?.state, 'urgent');
  assert.equal(rows[1]?.roomName, '603');
  assert.equal(rows[1]?.state, 'attention');
  assert.ok(rows.every(row => !/(张三|李四|王五)/.test(`${row.roomName}${row.detail}${row.status}`)));
});

test('builds patient-state rows with occupancy and room status without patient names', () => {
  const summaries = [
    makeSummary({
      roomIndex: 0,
      sickroomName: '601',
      priority: 'calling',
      occupiedBeds: 3,
      totalBeds: 4,
      callingCount: 1,
      infusingCount: 1,
      statusText: '呼叫 1 · 输液 1',
      accentColor: '#E91E63',
    }),
    makeSummary({
      roomIndex: 1,
      sickroomName: '602',
      priority: 'normal',
      occupiedBeds: 2,
      totalBeds: 4,
    }),
  ];

  const rows = buildNurseStationPatientRows(summaries, makeLiveData());

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.roomName, '601');
  assert.match(rows[0]?.detail ?? '', /3\/4 在床/);
  assert.match(rows[0]?.detail ?? '', /呼叫 1/);
  assert.equal(rows[0]?.status, '呼叫 1 · 输液 1');
  assert.equal(rows[0]?.state, 'urgent');
  assert.match(rows[1]?.detail ?? '', /2\/4 在床/);
});

test('returns explicit empty rows when no room-level data is available', () => {
  const live = makeLiveData({
    rooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    emptyBeds: 0,
    callingCount: 0,
    priorityRooms: [],
  });

  assert.deepEqual(buildNurseStationHandoffRows([], live), [{
    roomName: '病区',
    detail: '暂无重点事项',
    status: '待同步',
    state: 'normal',
    accentColor: '#4FC3F7',
  }]);
  assert.deepEqual(buildNurseStationPatientRows([], live), [{
    roomName: '病区',
    detail: '暂无患者数据',
    status: '待同步',
    state: 'normal',
    accentColor: '#4FC3F7',
  }]);
});
