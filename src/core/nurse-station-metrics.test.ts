import assert from 'node:assert/strict';
import test from 'node:test';
import type { TwinAreaEntity } from '../types/twin.ts';
import type { StatusCode } from '../types/ward.ts';
import { buildNurseStationMetrics } from './nurse-station-metrics.ts';

function createArea(overrides: Array<Partial<{ online: boolean; calling: boolean; occupied: boolean; status: StatusCode }>>): TwinAreaEntity {
  return {
    areaName: '测试病区',
    areaCode: 'TEST',
    deptName: '测试科室',
    rooms: [{
      sickroomName: '301房',
      sickroomCode: '301',
      sickroomId: '301',
      deviceCode: 'DOOR-301',
      isOnline: true,
      beds: overrides.map((item, index) => ({
        bedCode: String(index + 1),
        bedName: `${index + 1}床`,
        deviceCode: `BED-${index + 1}`,
        position: { x: 0, z: 0 },
        isOccupied: item.occupied ?? true,
        isOnline: item.online ?? true,
        isCalling: item.calling ?? false,
        statusBarInfo: item.status == null
          ? undefined
          : { bedCode: String(index + 1), deviceCode: `BED-${index + 1}`, status: item.status },
      })),
    }],
  };
}

test('uses device-level online counts including room terminals', () => {
  const metrics = buildNurseStationMetrics(createArea([
    { online: true },
    { status: '304' },
  ]), 3, 0);

  assert.equal(metrics.deviceTotal, 3);
  assert.equal(metrics.deviceOnline, 2);
  assert.equal(metrics.deviceHealthRate, 67);
});

test('returns urgent state for active calls and attention for device faults', () => {
  assert.equal(buildNurseStationMetrics(createArea([{ calling: true }]), 2, 0).state.level, 'urgent');
  assert.equal(buildNurseStationMetrics(createArea([{ status: '304' }]), 2, 0).state.level, 'attention');
  assert.equal(buildNurseStationMetrics(createArea([{ status: '9' }]), 2, 0).offlineBeds, 1);
  assert.equal(buildNurseStationMetrics(createArea([{ online: true }]), 2, 0).state.level, 'normal');
});
