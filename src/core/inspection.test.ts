import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectInspectionAlertTasks,
  associateInspectionRecords,
  mergeInspectionRecords,
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

test('matches the documented name-only inspection record within a unique room', () => {
  const [item] = normalizeInspectionRecords([record({ sickroomId: undefined, bedCode: undefined })], area);
  assert.equal(item?.roomCode, '18_03');
  assert.equal(item?.bedCode, 'bed-1');
});

test('reports duplicate names and foreign-area records without leaking patient details', () => {
  const duplicateArea = { ...area, rooms: [...area.rooms, { ...area.rooms[0], sickroomId: '202', sickroomCode: 'other' }] };
  const result = associateInspectionRecords([
    record({ sickroomId: undefined, bedCode: undefined }),
    record({ areaId: 99 }),
  ], duplicateArea, 8);
  assert.equal(result.records.length, 0);
  assert.equal(result.association.unmatched, 2);
  assert.equal(result.association.issues[0].reason, '病房信息不唯一');
  assert.equal(result.association.issues[1].reason, '记录不属于当前病区');
  assert.equal(JSON.stringify(result.association).includes('张三'), false);
});

test('counts associated history before deduplication and caps diagnostics', () => {
  const result = associateInspectionRecords([record(), record({ id: 10 }), ...Array.from({ length: 30 }, (_, index) => record({ sickroomId: 999, bedName: `unknown-${index}` }))], area, 8);
  assert.equal(result.records.length, 1);
  assert.equal(result.association.matched, 2);
  assert.equal(result.association.unmatched, 30);
  assert.equal(result.association.issues.length, 20);
  assert.equal(result.association.omittedIssueCount, 10);
});

test('groups repeated mismatches and explains current beds without silently relocating', () => {
  const differentRoom = { ...area.rooms[0], sickroomId: '202', sickroomCode: 'other', sickroomName: '另一病房', beds: [{ ...area.rooms[0].beds[0], bedCode: 'other-bed', bedName: '208床' }] };
  const result = associateInspectionRecords(Array.from({ length: 61 }, () => record({ bedCode: undefined, bedName: '208床' })), { ...area, rooms: [...area.rooms, differentRoom] }, 8);
  assert.equal(result.records.length, 0);
  assert.equal(result.association.issues.length, 1);
  assert.equal(result.association.issues[0].count, 61);
  assert.deepEqual(result.association.issues[0].currentBeds, ['1', '2']);
  assert.deepEqual(result.association.issues[0].otherRooms, ['另一病房']);
  assert.equal(result.association.omittedIssueCount, 0);
});

test('ambiguous inspection timestamps cannot silently close an overdue state', () => {
  const overdue = normalizeInspectionRecords([record()], area)[0];
  const normal = {...overdue,id:'new',state:'normal' as const,stateLabel:'已巡视'};
  assert.equal(mergeInspectionRecords([overdue],[normal])[0].state,'overdue');
  assert.equal(mergeInspectionRecords([{...overdue,timestampMs:-Infinity}],[{...normal,timestampMs:-Infinity}])[0].state,'overdue');
  assert.equal(mergeInspectionRecords([overdue],[{...normal,timestampMs:overdue.timestampMs+1}])[0].state,'normal');
  const conflicting = normalizeInspectionRecords([record({swipeState:'正常'}),record({id:10,swipeState:'异常'})],area);
  assert.equal(conflicting[0].state,'overdue');
});

test('rejects conflicting and duplicate bed names; supports room-only records', () => {
  assert.equal(associateInspectionRecords([record({ bedName: '2' })], area).association.unmatched, 1);
  const duplicateArea = { ...area, rooms: [{ ...area.rooms[0], beds: [...area.rooms[0].beds, { ...area.rooms[0].beds[0], bedCode: 'duplicate' }] }] };
  assert.equal(associateInspectionRecords([record({ bedCode: undefined })], duplicateArea).association.unmatched, 1);
  const result = associateInspectionRecords([record({ sickroomId: undefined, bedCode: undefined, bedName: '' })], area, 8);
  assert.equal(result.association.matched, 1);
  assert.equal(result.records[0].bedCode, undefined);
});

test('rejects conflicting room identifiers instead of selecting the first match', () => {
  const other = { ...area.rooms[0], sickroomId: '202', sickroomCode: 'other', sickroomName: '另一病房' };
  assert.deepEqual(normalizeInspectionRecords([record({ sickroomCode: 'other' })], { ...area, rooms: [...area.rooms, other] }), []);
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

test('keeps an acknowledged inspection visible until the source record recovers', () => {
  const overdue = summarizeInspectionRooms(
    normalizeInspectionRecords([record()], area),
    area,
  );
  const taskId = 'area:8:inspection:18_03:bed-1';
  const [acknowledged] = collectInspectionAlertTasks(overdue, 8, {
    [taskId]: {
      status: 'handling',
      eventStartedAt: '2026-09-03 09:10:00',
    },
  });
  assert.equal(acknowledged.status, 'handling');

  const newerOccurrence = summarizeInspectionRooms(
    normalizeInspectionRecords([
      record({ id: 12, swipeTime: '2026-09-03 10:10:00' }),
    ], area),
    area,
  );
  const [pending] = collectInspectionAlertTasks(newerOccurrence, 8, {
    [taskId]: {
      status: 'handling',
      eventStartedAt: '2026-09-03 09:10:00',
    },
  });
  assert.equal(pending.status, 'pending');
});
