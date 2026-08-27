import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeSwpEvents,
  summarizeSwpResponseMetrics,
} from './swp-event-normalizer.ts';
import type {
  SwpAlarmRecord,
  SwpCallRecord,
  SwpResponseTimelinessRecord,
} from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

function makeArea(): TwinAreaEntity {
  return {
    areaName: '心内科一病区',
    areaCode: 'A-1',
    deptName: '心内科',
    rooms: [
      {
        sickroomId: 'room-601',
        sickroomCode: '601',
        sickroomName: '601病房',
        deviceCode: 'door-601',
        beds: [
          {
            bedCode: 'bed-601-1',
            bedName: '1',
            deviceCode: 'terminal-601-1',
            position: { x: 0, z: 0 },
            isOccupied: true,
            isOnline: true,
            sickInfo: {
              bedCode: 'bed-601-1', bedName: '1', sickName: '张三', sickSex: '', sickAge: '',
              sickBirthday: '', sickNo: '', sickInTime: '', nursingLevel: '', nursingColor: '',
              sickAllergy: '', sickIsolation: '', sickDiet: '', sickSafetyPrecautions: '',
              visitDoctorName: '', visitDoctorUserDuty: '', visitDoctorUserProfessional: '',
              dutyNurseName: '', dutyNurseUserProfessional: '', visitDoctorUserRemark: '',
              dutyNurseUserRemark: '', visitDoctorUserPic: '', dutyNurseUserPic: '',
              areaHeadNurseName: '', areaHeadNurseUserPic: '',
            },
          },
        ],
      },
      {
        sickroomId: 'room-602',
        sickroomCode: '602',
        sickroomName: '602病房',
        deviceCode: 'door-602',
        beds: [{
          bedCode: 'bed-602-1', bedName: '1', deviceCode: 'terminal-602-1',
          position: { x: 0, z: 0 }, isOccupied: false, isOnline: true,
        }],
      },
    ],
  };
}

test('normalizes active call and infusion alarm records with stable IDs and exact locations', () => {
  const calls: SwpCallRecord[] = [{
    id: 91,
    areaId: 8,
    areaCode: 'A-1',
    deptCode: 'D-1',
    sickroomId: 'room-601',
    bedCode: 'bed-601-1',
    callFrom: '601房1床',
    callTo: '护士站',
    callModeCode: '0',
    callModeName: '普通呼叫',
    callMessage: '需要帮助',
    callStartTime: '2026-08-21 10:20:30',
    mediaPath: '',
    remark: 'BED-601-1',
    eventStatus: '0',
  }];
  const alarms: SwpAlarmRecord[] = [{
    alarmId: 'alarm-7',
    areaId: 8,
    sickroomCode: '602',
    deviceCode: 'terminal-602-1',
    alarmType: '输液即将结束',
    deviceType: '输液监护仪',
    alarmStartTime: '2026-08-21 10:22:00',
    eventStatus: '0',
  }];

  const events = normalizeSwpEvents({ area: makeArea(), areaId: 8, calls, alarms });

  assert.equal(events.length, 2);
  assert.match(events[0].id, /^swp:alarm:8:alarm-7:occ-[0-9a-f]{8}$/);
  assert.match(events[1].id, /^swp:call:8:91:occ-[0-9a-f]{8}$/);
  assert.deepEqual(events[0].location, {
    roomIndex: 1,
    roomCode: '602',
    roomName: '602病房',
    bedCode: 'bed-602-1',
    bedName: '1',
    patientName: undefined,
  });
  assert.equal(events[0].taskType, 'infusion');
  assert.equal(events[0].locationStatus, 'matched');
  assert.equal((events[0] as unknown as { locationSource?: string }).locationSource, 'device-code');
  assert.equal(events[1].location?.patientName, '张三');
  assert.equal(events[1].locationStatus, 'matched');
  assert.equal((events[1] as unknown as { locationSource?: string }).locationSource, 'sickroom-id');
  assert.equal(events[1].description, '601病房 1床呼叫护士站 · 需要帮助');
  assert.equal('callReport' in events[1], false);
});

test('formats an unlocated call as readable source and terminal information', () => {
  const [event] = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [{
      id: 'unlocated-call',
      areaId: 8,
      callFrom: '18_03床1',
      callTo: '1024管理机',
      callMessage: '呼叫',
      callStartTime: '2026-06-24 14:10:23',
      eventStatus: '0',
    }],
    alarms: [],
  });

  assert.equal(event.title, '患者呼叫');
  assert.equal(event.description, '18_03床1呼叫护士站');
  assert.doesNotMatch(event.description, /→|接收终端|1024管理机/);
});

test('deduplicates records and does not guess a location from display text', () => {
  const duplicate: SwpCallRecord = {
    eventId: 'call-1', areaId: '8', callFrom: '601房1床',
    callStartTime: '2026-08-21 10:20:30', eventStatus: '0',
  };
  const events = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [duplicate, { ...duplicate }],
    alarms: [],
  });

  assert.equal(events.length, 1);
  assert.match(events[0].id, /^swp:call:8:call-1:occ-[0-9a-f]{8}$/);
  assert.equal(events[0].location, null);
  assert.equal(events[0].locationLabel, '心内科一病区');
  assert.equal(events[0].locationStatus, 'missing-identifiers');
  assert.equal((events[0] as unknown as { locationSource?: string }).locationSource, undefined);
});

test('keeps same record IDs as separate occurrences when call start time changes', () => {
  const events = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [
      {
        id: 'reused-call-id',
        areaId: 8,
        sickroomId: 'room-601',
        bedCode: 'bed-601-1',
        callStartTime: '2026-08-24 09:00:00',
        eventStatus: '0',
      },
      {
        id: 'reused-call-id',
        areaId: 8,
        sickroomId: 'room-601',
        bedCode: 'bed-601-1',
        callStartTime: '2026-08-24 09:20:00',
        eventStatus: '0',
      },
    ],
    alarms: [],
  });

  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  assert.deepEqual(events.map(event => event.startedAt), [
    '2026-08-24 09:20:00',
    '2026-08-24 09:00:00',
  ]);
});

test('uses callFrom only when it exactly matches a known bed or device identifier', () => {
  const [event] = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [{
      id: 'call-from-code',
      areaId: 8,
      callFrom: 'bed-601-1',
      eventStatus: '0',
    }],
    alarms: [],
  });

  assert.equal(event.locationStatus, 'matched');
  assert.equal((event as unknown as { locationSource?: string }).locationSource, 'call-from-code');
  assert.equal(event.location?.roomCode, '601');
  assert.equal(event.location?.bedCode, 'bed-601-1');
});

test('uses a deterministic fingerprint when the backend omits its record ID', () => {
  const record: SwpAlarmRecord = {
    areaId: 8,
    deviceCode: 'terminal-601-1',
    alarmType: '输液报警',
    alarmStartTime: '2026-08-21 10:25:00',
    eventStatus: '0',
  };

  const first = normalizeSwpEvents({ area: makeArea(), areaId: 8, calls: [], alarms: [record] });
  const second = normalizeSwpEvents({ area: makeArea(), areaId: 8, calls: [], alarms: [{ ...record }] });

  assert.equal(first[0].id, second[0].id);
  assert.match(first[0].id, /^swp:alarm:8:auto-[0-9a-f]{8}$/);
});

test('refuses to locate an event when explicit room and device identifiers conflict', () => {
  const events = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [{
      id: 3,
      areaId: 8,
      sickroomId: 'room-601',
      bedCode: 'bed-601-1',
      deviceCode: 'terminal-602-1',
      eventStatus: '0',
    }],
    alarms: [],
  });

  assert.equal(events[0].location, null);
  assert.equal(events[0].locationStatus, 'unmatched-identifiers');
});

test('keeps active records governed by backend status instead of inferring expiry from age', () => {
  const events = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [{
      id: 5,
      areaId: 8,
      callStartTime: '2026-08-20 09:59:59',
      eventStatus: '0',
    }],
    alarms: [],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].startedAt, '2026-08-20 09:59:59');
  assert.equal(Object.prototype.hasOwnProperty.call(events[0], 'isSuspectedStale'), false);
});

test('uses a readable infusion title when alarm type is a dictionary code', () => {
  const events = normalizeSwpEvents({
    area: makeArea(),
    areaId: 8,
    calls: [],
    alarms: [{ id: 4, areaId: 8, alarmType: 2, eventStatus: '0' }],
  });

  assert.equal(events[0].title, '输液报警');
  assert.match(events[0].description, /报警代码 2/);
});

test('ignores non-active and cross-area records defensively', () => {
  const calls: SwpCallRecord[] = [
    { id: 1, areaId: 8, eventStatus: '1', callStartTime: '2026-08-21 10:00:00' },
    { id: 2, areaId: 9, eventStatus: '0', callStartTime: '2026-08-21 10:01:00' },
  ];
  assert.deepEqual(normalizeSwpEvents({ area: makeArea(), areaId: 8, calls, alarms: [] }), []);
});

test('summarizes response arrivals, unattended calls, and average response time', () => {
  const records: SwpResponseTimelinessRecord[] = [
    {
      id: 1,
      callStartTime: '2026-08-21 09:00:00',
      personnelOnArrivals: '李护士',
      swpUwbTimeOfArrivalVoList: [
        { personnelOnArrival: '李护士', efficiencyOfResponse: '00:01:30' },
        { personnelOnArrival: '王护士', efficiencyOfResponse: '45秒' },
      ],
    },
    {
      id: 2,
      callStartTime: '2026-08-21 09:30:00',
      personnelOnArrivals: '接听未到场',
      swpUwbTimeOfArrivalVoList: [],
    },
    {
      id: 3,
      callStartTime: '2026-08-21 09:45:00',
      personnelOnArrivals: '',
    },
  ];

  assert.deepEqual(summarizeSwpResponseMetrics(records), {
    callCount: 3,
    arrivedCallCount: 1,
    unattendedCallCount: 2,
    arrivalCount: 2,
    averageResponseSeconds: 68,
    latestCallAt: '2026-08-21 09:45:00',
  });
});
