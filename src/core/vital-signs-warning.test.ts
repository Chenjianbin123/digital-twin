import assert from 'node:assert/strict';
import test from 'node:test';

import { collectSwpAlertTasks } from './alert-workflow.ts';
import { normalizeSwpEvents } from './swp-event-normalizer.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const areaWithBed: TwinAreaEntity = {
  areaName: '一病区',
  areaCode: 'A1',
  deptName: '内科',
  rooms: [{
    sickroomName: '101病房',
    sickroomCode: '101',
    sickroomId: 'room-101',
    deviceCode: 'DOOR-101',
    beds: [{
      bedCode: 'B-01',
      bedName: '1',
      deviceCode: 'BED-01',
      position: { x: 0, z: 0 },
      isOccupied: true,
      isOnline: true,
    }],
  }],
};

test('recognizes callModeCode 8 as a vital warning', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 1,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:24:00',
      bedCode: 'B-01',
      callMessage: '血氧 88%',
    }],
    alarms: [],
  });

  assert.equal(event?.taskType, 'vital');
  assert.equal(event?.vitalMetric, 'bloodOxygen');
  assert.equal(event?.vitalValue, '88');
  assert.equal(event?.vitalUnit, '%');
  assert.match(event?.description ?? '', /血氧 88%/);
  assert.doesNotMatch(event?.description ?? '', /呼叫护士站/);
});

test('recognizes the backend vital-warning label when code is absent', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 2,
      areaId: 18,
      eventStatus: '0',
      callModeName: '生命体征预警',
      callStartTime: '2026-09-04 10:25:00',
      bedCode: 'B-01',
    }],
    alarms: [],
  });

  assert.equal(event?.taskType, 'vital');
});

test('uses the room identity before matching a repeated bed name', () => {
  const area: TwinAreaEntity = {
    ...areaWithBed,
    rooms: [
      ...areaWithBed.rooms,
      {
        sickroomName: '102病房',
        sickroomCode: '102',
        sickroomId: 'room-102',
        deviceCode: 'DOOR-102',
        beds: [{
          bedCode: 'B-02',
          bedName: '1',
          deviceCode: 'BED-02',
          position: { x: 1, z: 0 },
          isOccupied: true,
          isOnline: true,
        }],
      },
    ],
  };

  const [event] = normalizeSwpEvents({
    areaId: 18,
    area,
    calls: [{
      id: 8,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:25:30',
      sickroomId: 'room-102',
      bedName: '01床',
      callMessage: '血氧 89%',
    }],
    alarms: [],
  });

  assert.deepEqual(event?.location, {
    roomIndex: 1,
    roomCode: '102',
    roomName: '102病房',
    bedCode: 'B-02',
    bedName: '1',
    patientName: undefined,
  });
  assert.equal(event?.locationStatus, 'matched');
});

test('uses a unique backend room name when the room id is unavailable', () => {
  const area: TwinAreaEntity = {
    ...areaWithBed,
    rooms: [
      ...areaWithBed.rooms,
      {
        sickroomName: '102病房',
        sickroomCode: '102',
        sickroomId: 'room-102',
        deviceCode: 'DOOR-102',
        beds: [{
          bedCode: 'B-02',
          bedName: '1',
          deviceCode: 'BED-02',
          position: { x: 1, z: 0 },
          isOccupied: true,
          isOnline: true,
        }],
      },
    ],
  };

  const [event] = normalizeSwpEvents({
    areaId: 18,
    area,
    calls: [{
      id: 10,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:25:45',
      sickroomName: '102病房',
      bedName: '1床',
      callMessage: '血氧 90%',
    }],
    alarms: [],
  });

  assert.equal(event?.location?.roomCode, '102');
  assert.equal(event?.location?.bedCode, 'B-02');
  assert.equal(event?.locationStatus, 'matched');
});

test('keeps backend alarm level readable when the message only has raw vital fields', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 7,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:26:30',
      bedCode: 'B-01',
      mewsAlarmLevel: '高',
      mewsScore: '6',
    }],
    alarms: [],
  });

  assert.match(event?.description ?? '', /风险高/);
  assert.match(event?.description ?? '', /MEWS 6/);
});

test('keeps the unit from the readable message when the backend field is a bare value', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 9,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:26:45',
      bedCode: 'B-01',
      tw: '38.8',
      callMessage: '体温 38.8℃',
    }],
    alarms: [],
  });

  assert.equal(event?.vitalMetric, 'temperature');
  assert.equal(event?.vitalValue, '38.8');
  assert.equal(event?.vitalUnit, '℃');
  assert.match(event?.description ?? '', /体温 38\.8℃/);
});

test('does not classify ordinary calls as vital warnings', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 3,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 0,
      callModeName: '正常呼叫',
      callStartTime: '2026-09-04 10:26:00',
      bedCode: 'B-01',
    }],
    alarms: [],
  });

  assert.equal(event?.taskType, 'call');
  assert.equal(event?.vitalMetric, undefined);
});

test('maps a vital event to a source-managed, locatable alert task', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 4,
      areaId: 18,
      eventStatus: '0',
      callModeCode: '8',
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:27:00',
      bedCode: 'B-01',
      callMessage: '心率 125次/分',
    }],
    alarms: [],
  });

  const [task] = collectSwpAlertTasks([event!], {}, 18);
  assert.equal(task?.type, 'vital');
  assert.equal(task?.source, 'swp-call');
  assert.equal(task?.status, 'pending');
  assert.equal(task?.canLocate, true);
  assert.equal(task?.bedCode, 'B-01');
  assert.equal(task?.vitalMetric, 'heartRate');
});

test('deduplicates the same backend event occurrence but keeps a later occurrence', () => {
  const base = {
    id: 'mews-1',
    areaId: 18,
    eventStatus: '0',
    callModeCode: 8,
    callModeName: '体征报警',
    bedCode: 'B-01',
    callMessage: '血氧 88%',
  };
  const sameOccurrence = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [
      { ...base, callStartTime: '2026-09-04 10:28:00' },
      { ...base, callStartTime: '2026-09-04 10:28:00' },
    ],
    alarms: [],
  });
  const laterOccurrence = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [
      { ...base, callStartTime: '2026-09-04 10:28:00' },
      { ...base, callStartTime: '2026-09-04 10:29:00' },
    ],
    alarms: [],
  });

  assert.equal(sameOccurrence.length, 1);
  assert.equal(laterOccurrence.length, 2);
  assert.notEqual(laterOccurrence[0]?.id, laterOccurrence[1]?.id);
});

test('keeps an unlocatable vital warning visible without guessing a bed', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 5,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:31:00',
      callMessage: '血压 185mmHg',
    }],
    alarms: [],
  });
  const [task] = collectSwpAlertTasks([event!], {}, 18);

  assert.equal(event?.location, null);
  assert.equal(event?.locationStatus, 'missing-identifiers');
  assert.equal(task?.canLocate, false);
  assert.equal(task?.roomIndex, -1);
  assert.equal(task?.bedCode, undefined);
});

test('does not hide an active vital warning after a local acknowledgement', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 6,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:32:00',
      bedCode: 'B-01',
      callMessage: '心率 130次/分',
    }],
    alarms: [],
  });
  const [task] = collectSwpAlertTasks([event!], {
    [event!.id]: {
      status: 'resolved',
      eventStartedAt: event!.startedAt,
    },
  }, 18);

  assert.equal(task?.status, 'pending');
});
