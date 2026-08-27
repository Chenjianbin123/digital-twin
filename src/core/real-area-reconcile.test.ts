import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileRealAreaSnapshot } from './real-area-reconcile.ts';
import type { TwinAreaEntity, TwinWardEntity } from '../types/twin.ts';

function room(deviceCode: string, name: string): TwinWardEntity {
  return {
    sickroomName: name,
    sickroomCode: name,
    sickroomId: name,
    deviceCode,
    beds: [],
  };
}

function area(rooms: TwinWardEntity[]): TwinAreaEntity {
  return { areaName: '护理一区', areaCode: 'A1', deptName: '护理部', rooms };
}

test('keeps the last real room data when one discovered device detail fails', () => {
  const previous = area([room('door-1', '101'), room('door-2', '102')]);
  const incoming = area([room('door-1', '101新数据')]);
  const result = reconcileRealAreaSnapshot(incoming, previous, ['door-1', 'door-2']);

  assert.deepEqual(result.rooms.map(item => [item.deviceCode, item.sickroomName]), [
    ['door-1', '101新数据'],
    ['door-2', '102'],
  ]);
  assert.deepEqual(result.retainedDeviceCodes, ['door-2']);
});

test('does not retain rooms that are no longer returned by device discovery', () => {
  const previous = area([room('door-1', '101'), room('door-2', '102')]);
  const incoming = area([room('door-1', '101')]);
  const result = reconcileRealAreaSnapshot(incoming, previous, ['door-1']);
  assert.deepEqual(result.rooms.map(item => item.deviceCode), ['door-1']);
  assert.deepEqual(result.retainedDeviceCodes, []);
});

test('does not mix an old area into an initial load', () => {
  const incoming = area([room('door-1', '101')]);
  const result = reconcileRealAreaSnapshot(incoming, null, ['door-1', 'door-2']);
  assert.equal(result.area, incoming);
  assert.deepEqual(result.retainedDeviceCodes, []);
});
