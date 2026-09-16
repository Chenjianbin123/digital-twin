import assert from 'node:assert/strict';
import test from 'node:test';
import { isWardBedInfusing, selectOccupiedWardBeds, wardInteriorRoomKey } from './ward-interior-beds.ts';
import type { TwinBedEntity, TwinWardEntity } from '../types/twin.ts';
const bed = (code: string, occupied = true): TwinBedEntity => ({ bedCode: code, bedName: code, deviceCode: code, position: { x: 0, z: 0 }, isOccupied: occupied, isOnline: true });
const room = (beds: TwinBedEntity[], id = 'R'): TwinWardEntity => ({ sickroomId: id, sickroomCode: id, sickroomName: id, deviceCode: id, beds });
test('occupancy drives display, stable ordering does not mutate API lists', () => {
  const value = room([bed('10'), bed('2'), bed('1', false)]);
  assert.deepEqual(selectOccupiedWardBeds(value).beds.map(b => b.bedCode), ['2', '10']);
  assert.deepEqual(value.beds.map(b => b.bedCode), ['10', '2', '1']);
  assert.equal(selectOccupiedWardBeds(room([])).beds.length, 0);
});
test('rejects ambiguous and missing bed identifiers instead of attaching patient data', () => {
  const result = selectOccupiedWardBeds(room([bed('A'), bed('A'), bed('  '), bed('B')]));
  assert.deepEqual(result.beds.map(b => b.bedCode), ['B']);
  assert.equal(result.invalidCount, 3);
  assert.equal(result.occupiedCount, 4);
});
test('same bed code in different rooms has a different binding scope', () => {
  assert.notEqual(wardInteriorRoomKey(room([bed('A')], 'R1')), wardInteriorRoomKey(room([bed('A')], 'R2')));
});
test('infusion is independent from call priority and only known active codes enable equipment', () => {
  const value = bed('A'); value.isCalling = true;
  for (const status of ['300', '301', '302', '305', '304', '307', '9', ''] as const) {
    value.statusBarInfo = { bedCode: 'A', deviceCode: 'A', status };
    assert.equal(isWardBedInfusing(value), status === '300' || status === '301');
  }
  value.isOccupied = false;
  value.statusBarInfo!.status = '300';
  assert.equal(isWardBedInfusing(value), false);
});
