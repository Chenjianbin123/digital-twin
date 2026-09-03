import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectInspectionAlertTasks,
  normalizeInspectionRecords,
  summarizeInspectionRooms,
} from './inspection.ts';
import type { SwpInspectionRecord } from '../types/inspection.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const area: TwinAreaEntity = {
  areaName: '心内科一病区',
  areaCode: 'A-01',
  deptName: '心内科',
  rooms: [
    {
      sickroomId: '101',
      sickroomCode: '18_03',
      sickroomName: '18_03病房',
      deviceCode: 'door-101',
      beds: [
        {
          bedCode: 'bed-1',
          bedName: '1',
          deviceCode: 'terminal-1',
          position: { x: 0, z: 0 },
          isOccupied: true,
          isOnline: true,
        },
        {
          bedCode: 'bed-2',
          bedName: '2',
          deviceCode: 'terminal-2',
          position: { x: 1, z: 0 },
          isOccupied: true,
          isOnline: true,
        },
      ],
    },
  ],
};

function record(overrides: Partial<SwpInspectionRecord> = {}): SwpInspectionRecord {
  return {
    id: 9,
    areaId: 8,
    sickroomId: 101,
    sickroomName: '18_03病房',
    bedCode: 'bed-1',
    bedName: '1',
    sickName: '张三',
    nursingLevel: '一级护理',
    doorUserRealname: '王护士',
    swipeState: '巡视超时',
    swipeTime: '2026-09-03 09:10:00',
    swipeInterval: '50分钟',
    ...overrides,
  };
}

test('normalizes a real inspection record to an exact room and bed', () => {
  const [normalized] = normalizeInspectionRecords([record()], area);

  assert.equal(normalized.roomIndex, 0);
  assert.equal(normalized.roomCode, '18_03');
  assert.equal(normalized.bedCode, 'bed-1');
  assert.equal(normalized.bedName, '1');
  assert.equal(normalized.patientName, '张三');
  assert.equal(normalized.nurseName, '王护士');
  assert.equal(normalized.state, 'overdue');
  assert.equal(normalized.occurredAt, '2026-09-03 09:10:00');
});

test('supports the actual inspection fields and normal/abnormal states returned by swp-admin', () => {
  const [normalized] = normalizeInspectionRecords([
    record({
      nursingLevel: undefined,
      swipeInterval: undefined,
      lastSwipeUser: undefined,
      sickNursingLevel: '一级护理',
      intervalSwipeDuration: '50分钟',
      lastDoorUserRealname: '李护士',
      swipeState: '异常',
    }),
  ], area);

  assert.equal(normalized.state, 'overdue');
  assert.equal(normalized.nursingLevel, '一级护理');
  assert.equal(normalized.intervalLabel, '50分钟');
  assert.equal(normalized.previousNurseName, '李护士');
});

test('does not invent a room when inspection identifiers cannot be matched', () => {
  const normalized = normalizeInspectionRecords([
    record({
      sickroomId: 999,
      sickroomName: '未知病房',
      bedCode: 'unknown-bed',
    }),
  ], area);

  assert.deepEqual(normalized, []);
});

test('keeps the newest inspection state for each bed', () => {
  const normalized = normalizeInspectionRecords([
    record({ id: 1, swipeState: '巡视超时', swipeTime: '2026-09-03 09:10:00' }),
    record({ id: 2, swipeState: '已巡视', swipeTime: '2026-09-03 09:30:00' }),
  ], area);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].state, 'normal');
  assert.equal(normalized[0].occurredAt, '2026-09-03 09:30:00');
});

test('summarizes room inspection attention without frontend-made thresholds', () => {
  const records = normalizeInspectionRecords([
    record(),
    record({
      id: 10,
      bedCode: 'bed-2',
      bedName: '2',
      sickName: '李四',
      swipeState: '已巡视',
      swipeTime: '2026-09-03 09:25:00',
    }),
  ], area);
  const [summary] = summarizeInspectionRooms(records, area);

  assert.equal(summary.state, 'overdue');
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.normalCount, 1);
  assert.equal(summary.latestAt, '2026-09-03 09:25:00');
  assert.equal(summary.latestNurseName, '王护士');
});

test('creates location-only overdue tasks and removes them after a newer normal record', () => {
  const overdue = summarizeInspectionRooms(
    normalizeInspectionRecords([record()], area),
    area,
  );
  const [task] = collectInspectionAlertTasks(overdue, 8);

  assert.equal(task.id, 'area:8:inspection:18_03:bed-1');
  assert.equal(task.type, 'inspection');
  assert.equal(task.source, 'swp-inspection');
  assert.equal(task.status, 'pending');
  assert.equal(task.title, '巡视超时');
  assert.equal(task.actionText, '定位床位');
  assert.equal(task.canLocate, true);
  assert.match(task.description, /18_03病房 1床/);
  assert.match(task.description, /王护士/);

  const recovered = summarizeInspectionRooms(
    normalizeInspectionRecords([
      record(),
      record({ id: 11, swipeState: '已巡视', swipeTime: '2026-09-03 09:40:00' }),
    ], area),
    area,
  );
  assert.deepEqual(collectInspectionAlertTasks(recovered, 8), []);
});
