import assert from 'node:assert/strict';
import test from 'node:test';
import { mockCalls, mockAlarms, mockResponses, mockInspections, mockPage } from './clinical-records.ts';
import { MOCK_DOOR_DEVICE_LIST } from './door-device-list.ts';
import { mapDoorListToTwinArea } from '../types/twin.ts';
import { normalizeSwpEvents } from '../core/swp-event-normalizer.ts';
import { associateInspectionRecords } from '../core/inspection.ts';

test('default rooms expose three distinct physical beds and preserve vacant rooms', () => {
  const rooms = MOCK_DOOR_DEVICE_LIST.data;
  assert.equal(rooms.length, 10);
  const bedCodes = rooms.flatMap(room => room.bedDeviceList.map(bed => bed.bedCode));
  assert.equal(new Set(bedCodes).size, 30);
  for (const room of rooms) {
    assert.deepEqual(room.bedDeviceList.map(bed => bed.bedName), ['01', '02', '03']);
    assert.equal(room.doorSickInfoList.length, ['306房', '310房'].includes(room.doorDeviceInfo.sickroomName) ? 0 : 1);
  }
});

test('clinical fixtures match local room and bed identities', () => {
  const areaId = Number(MOCK_DOOR_DEVICE_LIST.data[0].doorDeviceInfo.areaId);
  const rooms = MOCK_DOOR_DEVICE_LIST.data;
  for (const records of [mockCalls(areaId), mockAlarms(areaId), mockInspections(areaId)]) {
    assert.ok(records.length > 0);
    for (const record of records) {
      const room = rooms.find(item => item.doorDeviceInfo.sickroomCode === record.sickroomCode);
      assert.ok(room);
      assert.ok(room.bedDeviceList.some(bed => bed.bedCode === record.bedCode));
    }
  }
  assert.equal(mockResponses(areaId).length, 4);
  assert.deepEqual(mockCalls(-1), []);
});

test('paging returns independent snapshots and correct boundaries', () => {
  const records = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const page = mockPage(records, 1, 2);
  assert.equal(page.coverage.complete, false);
  assert.equal(page.coverage.total, 3);
  page.records[0].id = 999;
  assert.equal(records[0].id, 1);
  assert.deepEqual(mockPage(records, 2, 2).records, [{ id: 3 }]);
  assert.deepEqual(mockPage(records, 3, 2).records, []);
  assert.equal(mockPage([]).coverage.complete, true);
});

test('clinical records normalize to exact rooms and beds in the workspace', () => {
  const area = mapDoorListToTwinArea(MOCK_DOOR_DEVICE_LIST.data);
  const areaId = Number(MOCK_DOOR_DEVICE_LIST.data[0].doorDeviceInfo.areaId);
  const events = normalizeSwpEvents({ area, areaId, calls: mockCalls(areaId), alarms: mockAlarms(areaId) });
  assert.equal(events.length, 3);
  assert.ok(events.every(event => event.locationStatus === 'matched' && event.location?.bedCode));
  const inspections = associateInspectionRecords(mockInspections(areaId), area, areaId);
  assert.equal(inspections.association.unmatched, 0);
  assert.equal(inspections.records.length, area.rooms.length);
});
