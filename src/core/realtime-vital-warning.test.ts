import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRealtimeVitalMessage } from './realtime-vital-warning.ts';

test('normalizes the Android sendMewsAlarm payload into an active call record', () => {
  const record = normalizeRealtimeVitalMessage({
    Cmd: 'sendMewsAlarm',
    Message: {
      bedId: 1,
      bedName: '1',
      sickroomId: 'room-101',
      pushTime: '2026-09-04 10:30:00',
      mewsAlarmLevel: '高',
      mewsScore: '7',
      tw: '38.8℃',
      ecg: '125次/分',
      hx: '28次/分',
      ssy: '185mmHg',
    },
  });

  assert.equal(record?.callModeCode, 8);
  assert.equal(record?.callModeName, '体征报警');
  assert.equal(record?.sickroomId, 'room-101');
  assert.equal(record?.bedName, '1');
  assert.equal(record?.callStartTime, '2026-09-04 10:30:00');
  assert.match(String(record?.callMessage), /MEWS 7/);
  assert.match(String(record?.callMessage), /体温 38\.8℃/);
});

test('ignores unrelated realtime commands and messages without location', () => {
  assert.equal(normalizeRealtimeVitalMessage({ Cmd: 'sendAlarmMessage', Message: {} }), null);
  assert.equal(normalizeRealtimeVitalMessage({
    Cmd: 'sendMewsAlarm',
    Message: { mewsScore: '5', pushTime: '2026-09-04 10:30:00' },
  }), null);
  assert.equal(normalizeRealtimeVitalMessage({
    Cmd: 'sendMewsAlarm',
    areaId: 18,
    Message: { mewsScore: '5', pushTime: '2026-09-04 10:30:00' },
  }), null);
});

test('does not invent a measurement time when the push omits one', () => {
  const record = normalizeRealtimeVitalMessage({
    Cmd: 'sendMewsAlarm',
    Message: {
      sickroomId: 'room-101',
      bedName: '1床',
      mewsScore: '5',
    },
  });

  assert.equal(record?.callStartTime, undefined);
});
