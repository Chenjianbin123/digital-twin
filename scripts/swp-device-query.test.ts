import assert from 'node:assert/strict';
import { createAreaRequestGuard } from '../src/core/area-request-guard.ts';
import {
  buildSwpDeviceQueryBody,
  SWP_DEVICE_LIST_PATH,
} from '../src/core/swp-device-query.ts';

assert.equal(
  SWP_DEVICE_LIST_PATH,
  'swp/swpDeviceInfo/querySwpDeviceInfo',
);

assert.deepEqual(buildSwpDeviceQueryBody({ areaId: 192 }), {
  areaId: 192,
  deptId: '',
  deviceIp: '',
  deviceName: '',
  deviceTypeId: 4,
  online: '',
  pageNum: 1,
  pageSize: 100,
  sipNo: '',
});
assert.throws(() => buildSwpDeviceQueryBody({ areaId: 0 }), /有效病区/);

const optionsWithExtraDeviceType = { areaId: 192, deviceTypeId: 3 };
assert.equal(buildSwpDeviceQueryBody(optionsWithExtraDeviceType).deviceTypeId, 4);

const guard = createAreaRequestGuard();
const first = guard.begin();
const second = guard.begin();
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);
