import assert from 'node:assert/strict';
import test from 'node:test';

import * as alertWorkflow from './alert-workflow.ts';
import {
  collectAlertTasks,
  collectLocallyHiddenSwpAlertTasks,
  collectSwpAlertTasks,
  findAlertTaskForTarget,
  mergeAlertTasks,
  resolveAlertTargetInArea,
  resolveNextAlertTarget,
  suppressLocalBedCallsShadowedBySwp,
  type AlertTask,
} from './alert-workflow.ts';
import type { NormalizedSwpEvent } from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

function event(overrides: Partial<NormalizedSwpEvent> = {}): NormalizedSwpEvent {
  return {
    id: 'swp:call:8:91',
    source: 'swp-call',
    areaId: 8,
    taskType: 'call',
    severity: 'critical',
    startedAt: '2026-08-21 10:20:30',
    timestampMs: 1,
    title: '普通呼叫',
    description: '601房1床 → 护士站',
    locationStatus: 'matched',
    locationLabel: '601病房',
    location: {
      roomIndex: 0,
      roomCode: '601',
      roomName: '601病房',
      bedCode: 'bed-1',
      bedName: '1',
      patientName: '张三',
    },
    ...overrides,
  };
}

function deviceAlertArea(status: '300' | '301' | '302' | '305' | '304' | '307' | '9'): TwinAreaEntity {
  return {
    areaName: '心内科病区',
    areaCode: 'A1',
    deptName: '心内科',
    rooms: [{
      sickroomName: '601病房',
      sickroomCode: '601',
      sickroomId: '601',
      deviceCode: 'door-601',
      beds: [{
        bedCode: 'bed-1',
        bedName: '1',
        deviceCode: 'terminal-1',
        position: { x: 0, z: 0 },
        isOccupied: true,
        isOnline: true,
        statusBarInfo: { bedCode: 'bed-1', deviceCode: 'terminal-1', status },
      }],
    }],
  };
}

function infusionArea(status: '300' | '301' | '302' | '305' | '304' | '307' | '9'): TwinAreaEntity {
  return deviceAlertArea(status);
}

test('creates a nurse-friendly infusion round task for both active infusion statuses', () => {
  for (const status of ['300', '301'] as const) {
    const [task] = collectAlertTasks(infusionArea(status));
    assert.equal(task.type, 'infusion');
    assert.equal(task.title, '输液巡视');
    assert.match(task.description, /601病房 1床正在输液/);
    assert.match(task.description, /确认滴速和通路/);
    assert.equal(task.actionText, '查看床位');
  }
});

test('does not create a pending task for completed infusion status', () => {
  assert.equal(collectAlertTasks(infusionArea('302')).length, 0);
  assert.equal(collectAlertTasks(infusionArea('305')).length, 0);
});

test('prioritizes device faults over infusion round task', () => {
  for (const status of ['304', '307', '9'] as const) {
    const [task] = collectAlertTasks(infusionArea(status));
    assert.equal(task.type, 'offline');
    assert.notEqual(task.title, '输液巡视');
  }
});

test('keeps an active device fault visible until the source status recovers', () => {
  const area = deviceAlertArea('304');
  const taskId = 'area:8:offline:601:bed-1';

  const [activeTask] = collectAlertTasks(area, { [taskId]: 'resolved' }, 8);

  assert.equal(activeTask.id, taskId);
  assert.equal(activeTask.status, 'pending');
  assert.equal(collectAlertTasks(deviceAlertArea('302'), { [taskId]: 'handling' }, 8).length, 0);
});

test('keeps an active SWP alarm visible and does not place it in a hidden list', () => {
  const alarm = event({
    id: 'swp:alarm:8:7',
    source: 'swp-alarm',
    taskType: 'infusion',
    severity: 'high',
  });
  const ackState = {
    [alarm.id]: {
      status: 'resolved' as const,
      eventStartedAt: alarm.startedAt,
    },
  };

  const [activeTask] = collectSwpAlertTasks([alarm], ackState);
  assert.equal(activeTask.status, 'pending');
  assert.deepEqual(collectLocallyHiddenSwpAlertTasks([alarm], ackState), []);
});

test('resets handling when the same SWP source ID starts a new alarm occurrence', () => {
  const alarm = event({
    id: 'swp:alarm:8:7',
    source: 'swp-alarm',
    taskType: 'infusion',
    severity: 'high',
    startedAt: '2026-08-25 10:00:00',
  });
  const [newOccurrence] = collectSwpAlertTasks([{
    ...alarm,
    startedAt: '2026-08-25 11:00:00',
  }], {
    [alarm.id]: {
      status: 'handling',
      eventStartedAt: alarm.startedAt,
    },
  });

  assert.equal(newOccurrence.status, 'pending');
});

test('gives nurses distinct actions for offline, abnormal-offline, and low-battery devices', () => {
  const [offline] = collectAlertTasks(deviceAlertArea('304'));
  const [abnormalOffline] = collectAlertTasks(deviceAlertArea('307'));
  const [lowBattery] = collectAlertTasks(deviceAlertArea('9'));

  assert.equal(offline.title, '设备离线');
  assert.match(offline.description, /检查设备电源和网络/);
  assert.equal(abnormalOffline.title, '异常离线');
  assert.match(abnormalOffline.description, /检查设备连接和运行状态/);
  assert.equal(lowBattery.title, '低电量');
  assert.match(lowBattery.description, /充电或更换电池/);
});

test('removes a device alert after its current status recovers', () => {
  assert.equal(collectAlertTasks(deviceAlertArea('304')).length, 1);
  assert.equal(collectAlertTasks(deviceAlertArea('302')).length, 0);
});

test('turns environment readings into clear nurse actions and removes the task after recovery', () => {
  const area = deviceAlertArea('302');
  area.rooms[0].doorEnvData = {
    temp: '31',
    relativeHumid: '55%',
    airQuality: '优',
    noiseLevel: '40',
  };

  const [danger] = collectAlertTasks(area);
  assert.equal(danger.title, '病房温度异常');
  assert.match(danger.description, /31℃/);
  assert.match(danger.description, /检查空调和通风/);

  area.rooms[0].doorEnvData = {
    temp: '24',
    relativeHumid: '55%',
    airQuality: '优',
    noiseLevel: '40',
  };
  assert.equal(collectAlertTasks(area).length, 0);
});

test('summarizes multiple environment issues without exposing raw fields', () => {
  const area = deviceAlertArea('302');
  area.rooms[0].doorEnvData = {
    temp: '29',
    relativeHumid: '70%',
    airQuality: '中',
    noiseLevel: '52',
  };

  const [task] = collectAlertTasks(area);
  assert.equal(task.title, '病房环境预警');
  assert.match(task.description, /温度偏高/);
  assert.match(task.description, /湿度偏高/);
  assert.match(task.description, /空气质量下降/);
  assert.match(task.description, /噪音偏高/);
  assert.match(task.description, /请复核病房环境/);
});

test('formats the elapsed waiting time for active clinical tasks', () => {
  const formatter = (alertWorkflow as Record<string, unknown>).formatAlertWaitingTime;
  assert.equal(typeof formatter, 'function');
  if (typeof formatter !== 'function')
    return;

  const now = new Date('2026-08-21T10:20:00');
  assert.equal(formatter('2026-08-21 10:19:40', now), '已等待不足1分钟');
  assert.equal(formatter('2026-08-21 10:16:00', now), '已等待4分钟');
  assert.equal(formatter('2026-08-21 08:50:00', now), '已等待1小时30分钟');
  assert.equal(formatter('2026-08-19 07:20:00', now), '已等待2天3小时');
  assert.equal(formatter('无效时间', now), '');
  assert.equal(formatter('2026-08-21 10:21:00', now), '');
});

test('maps normalized SWP events into actionable tasks without hiding active source events', () => {
  const tasks = collectSwpAlertTasks([
    event(),
    event({ id: 'swp:alarm:8:7', taskType: 'infusion', source: 'swp-alarm', severity: 'high' }),
  ], {
    'swp:call:8:91': 'handling',
    'swp:alarm:8:7': 'resolved',
  });

  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[0], {
    id: 'swp:call:8:91',
    type: 'call',
    severity: 'critical',
    status: 'pending',
    roomIndex: 0,
    roomName: '601病房',
    roomCode: '601',
    bedCode: 'bed-1',
    bedName: '1',
    patientName: '张三',
    title: '普通呼叫',
    description: '601房1床 → 护士站',
    actionText: '定位床位',
    canLocate: true,
    source: 'swp-call',
    startedAt: '2026-08-21 10:20:30',
    locationStatus: 'matched',
  });
  assert.equal(tasks[1].id, 'swp:alarm:8:7');
  assert.equal(tasks[1].status, 'pending');
});

test('uses location-only actions for active SWP calls', () => {
  const [located] = collectSwpAlertTasks([event()]);
  const [unlocated] = collectSwpAlertTasks([event({
    id: 'swp:call:8:unlocated',
    location: null,
    locationStatus: 'missing-identifiers',
    locationLabel: '心内科一病区',
  })]);

  assert.equal(located.actionText, '定位床位');
  assert.equal(unlocated.actionText, '定位病房');
});

test('orders same-severity tasks by the longest waiting call first', () => {
  const newer = event({
    id: 'swp:call:8:newer',
    startedAt: '2026-08-21 10:30:00',
    timestampMs: 2,
  });
  const older = event({
    id: 'swp:call:8:older',
    startedAt: '2026-08-21 10:20:00',
    timestampMs: 1,
  });

  const tasks = collectSwpAlertTasks([newer, older]);

  assert.deepEqual(tasks.map(task => task.id), [
    'swp:call:8:older',
    'swp:call:8:newer',
  ]);
});

test('keeps SWP calls pending and orders them by waiting time despite legacy handling state', () => {
  const olderHandling = event({
    id: 'swp:call:8:older-handling',
    startedAt: '2026-08-24 10:00:00',
    timestampMs: 1,
  });
  const newerPending = event({
    id: 'swp:call:8:newer-pending',
    startedAt: '2026-08-24 10:20:00',
    timestampMs: 2,
  });

  const tasks = collectSwpAlertTasks([olderHandling, newerPending], {
    [olderHandling.id]: 'handling',
  });

  assert.deepEqual(tasks.map(task => task.id), [
    'swp:call:8:older-handling',
    'swp:call:8:newer-pending',
  ]);
  assert.deepEqual(tasks.map(task => task.status), ['pending', 'pending']);
});

test('resolves waiting escalation levels from centralized thresholds', () => {
  const resolver = (alertWorkflow as Record<string, unknown>).getAlertWaitingLevel;
  assert.equal(typeof resolver, 'function');
  if (typeof resolver !== 'function')
    return;

  const now = new Date('2026-08-24T10:20:00');
  assert.equal(resolver('2026-08-24 10:16:00', now), 'normal');
  assert.equal(resolver('2026-08-24 10:14:00', now), 'attention');
  assert.equal(resolver('2026-08-24 10:09:00', now), 'urgent');
});

test('creates a short-lived alert bed focus that can be cleared by task resolution', () => {
  const create = (alertWorkflow as Record<string, unknown>).createAlertFocus;
  const expired = (alertWorkflow as Record<string, unknown>).isAlertFocusExpired;
  const belongsToTask = (alertWorkflow as Record<string, unknown>).isAlertFocusForTask;
  assert.equal(typeof create, 'function');
  assert.equal(typeof expired, 'function');
  assert.equal(typeof belongsToTask, 'function');
  if (
    typeof create !== 'function'
    || typeof expired !== 'function'
    || typeof belongsToTask !== 'function'
  )
    return;

  const focus = create('swp:call:8:bed-1', 2, 'bed-1', 1_000);
  assert.deepEqual(focus, {
    taskId: 'swp:call:8:bed-1',
    roomIndex: 2,
    bedCode: 'bed-1',
    expiresAtMs: 9_000,
  });
  assert.equal(expired(focus, 8_999), false);
  assert.equal(expired(focus, 9_000), true);
  assert.equal(belongsToTask(focus, 'swp:call:8:bed-1'), true);
  assert.equal(belongsToTask(focus, 'other-task'), false);
});

test('keeps unlocated SWP events as area-level tasks without inventing a room target', () => {
  const [task] = collectSwpAlertTasks([event({
    id: 'swp:call:8:unknown',
    location: null,
    locationLabel: '心内科一病区',
    locationStatus: 'missing-identifiers',
  })]);

  assert.equal(task.roomIndex, -1);
  assert.equal(task.roomName, '');
  assert.equal(task.canLocate, false);
  assert.equal(task.locationStatus, 'missing-identifiers');
  assert.equal(task.resolveText, undefined);
  assert.deepEqual(resolveNextAlertTarget(task), {
    sceneType: 'nurse-station',
    roomIndex: -1,
  });
});

test('merges alert sources by stable task ID and severity', () => {
  const medium = {
    ...collectSwpAlertTasks([event({ id: 'medium', severity: 'high' })])[0],
    type: 'infusion' as const,
    severity: 'medium' as const,
  };
  const critical = collectSwpAlertTasks([event({ id: 'critical' })])[0];
  const duplicate: AlertTask = { ...critical, title: '重复项' };

  const merged = mergeAlertTasks([medium, critical], [duplicate]);
  assert.deepEqual(merged.map(item => [item.id, item.title]), [
    ['critical', '普通呼叫'],
    ['medium', '普通呼叫'],
  ]);
});

test('merges the same bed call across SWP and device-state sources', () => {
  const swp = collectSwpAlertTasks([event()])[0];
  const local: AlertTask = {
    ...swp,
    id: 'area:8:call:601:bed-1',
    title: '床位呼叫',
  };

  const merged = mergeAlertTasks([swp], [local]);
  assert.deepEqual(merged.map(item => item.id), ['swp:call:8:91']);
});

test('does not inherit handling acknowledgement from an equivalent local bed-call task', () => {
  const [task] = collectSwpAlertTasks([event()], {
    'area:8:call:601:bed-1': 'handling',
  }, 8);
  assert.equal(task.status, 'pending');

  const newSwpEventAfterLocalResolution = collectSwpAlertTasks([event()], {
    'area:8:call:601:bed-1': 'resolved',
  }, 8);
  assert.equal(newSwpEventAfterLocalResolution[0].status, 'pending');
});

test('keeps an active SWP call visible despite a legacy local resolved record', () => {
  const ignoredEvent = event({ startedAt: '2026-08-21 10:20:30' });
  const ackState = {
    [ignoredEvent.id]: {
      status: 'resolved' as const,
      eventStartedAt: ignoredEvent.startedAt,
    },
  };

  const [activeTask] = collectSwpAlertTasks([ignoredEvent], ackState);
  assert.equal(activeTask.status, 'pending');

  const [newTask] = collectSwpAlertTasks([{
    ...ignoredEvent,
    startedAt: '2026-08-21 10:35:30',
  }], ackState);
  assert.equal(newTask.status, 'pending');
});

test('does not derive locally hidden tasks from active SWP calls', () => {
  const hiddenEvent = event();
  const hidden = collectLocallyHiddenSwpAlertTasks([hiddenEvent], {
    [hiddenEvent.id]: {
      status: 'resolved',
      eventStartedAt: hiddenEvent.startedAt,
    },
  });

  assert.deepEqual(hidden, []);

  assert.deepEqual(collectLocallyHiddenSwpAlertTasks([{
    ...hiddenEvent,
    startedAt: '2026-08-21 10:35:30',
  }], {
    [hiddenEvent.id]: {
      status: 'resolved',
      eventStartedAt: hiddenEvent.startedAt,
    },
  }), []);
});

test('suppresses a local bed call while the same SWP event is still active even after resolution', () => {
  const local: AlertTask = {
    ...collectSwpAlertTasks([event()])[0],
    id: 'area:8:call:601:bed-1',
  };
  assert.deepEqual(suppressLocalBedCallsShadowedBySwp([local], [event()]), []);
});

test('re-resolves an alert room by stable code after room order changes', () => {
  const task = collectSwpAlertTasks([event()])[0];
  const area = {
    areaName: '一病区', areaCode: 'A1', deptName: '内科',
    rooms: [
      { sickroomId: '602', sickroomCode: '602', sickroomName: '602病房', deviceCode: 'd2', beds: [] },
      {
        sickroomId: '601', sickroomCode: '601', sickroomName: '601病房', deviceCode: 'd1',
        beds: [{ bedCode: 'bed-1', bedName: '1', deviceCode: 'b1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true }],
      },
    ],
  };

  assert.deepEqual(resolveAlertTargetInArea(task, area), {
    sceneType: 'ward-interior',
    roomIndex: 1,
    bedCode: 'bed-1',
  });
});

test('finds the active room alert by stable room code after room order changes', () => {
  const task = collectSwpAlertTasks([event()])[0];
  const area = {
    areaName: '一病区', areaCode: 'A1', deptName: '内科',
    rooms: [
      { sickroomId: '602', sickroomCode: '602', sickroomName: '602病房', deviceCode: 'd2', beds: [] },
      {
        sickroomId: '601', sickroomCode: '601', sickroomName: '601病房', deviceCode: 'd1',
        beds: [{ bedCode: 'bed-1', bedName: '1', deviceCode: 'b1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true }],
      },
    ],
  };

  assert.equal(findAlertTaskForTarget([task], {
    sceneType: 'ward-interior',
    roomIndex: 1,
    bedCode: 'bed-1',
  }, area), task);
});
