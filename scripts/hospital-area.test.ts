import assert from 'node:assert/strict';
import { normalizeHospitalAreaRecords } from '../src/core/hospital-area.ts';
import {
  allowAllAreaAccessPolicy,
  resolvePreferredAreaId,
  resolveRememberedAreaId,
} from '../src/core/area-access.ts';

const areas = normalizeHospitalAreaRecords([
  { id: 192, areaName: ' 呼吸内科三病区 ', areaCode: 'A03', isEnable: '1' },
  { id: 193, areaName: '呼吸内科五病区', areaCode: 'A05', isEnable: '0' },
  { id: 192, areaName: '重复病区', areaCode: 'DUP', isEnable: '1' },
  { id: 0, areaName: '无效病区', areaCode: 'BAD', isEnable: '1' },
]);

assert.deepEqual(areas, [{
  id: 192,
  areaName: '呼吸内科三病区',
  areaCode: 'A03',
  areaOutCode: '',
  isEnable: '1',
}]);
assert.deepEqual(allowAllAreaAccessPolicy.filterAreas(areas), areas);
assert.equal(allowAllAreaAccessPolicy.canSwitchArea(192, 193), true);
assert.equal(resolvePreferredAreaId(areas, '192', '99'), 192);
assert.equal(resolvePreferredAreaId(areas, '99', '192'), 192);
assert.equal(resolvePreferredAreaId(areas, null, null), 192);
assert.equal(resolvePreferredAreaId([], '192', '192'), null);
assert.equal(resolveRememberedAreaId(areas, '192'), 192);
assert.equal(resolveRememberedAreaId(areas, '99'), null);
assert.equal(resolveRememberedAreaId(areas, null), null);
assert.equal(resolveRememberedAreaId(areas, 'invalid'), null);
