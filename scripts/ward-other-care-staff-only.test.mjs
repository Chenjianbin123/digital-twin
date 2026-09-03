import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [wardPanel, staffPanel] = await Promise.all([
  readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/DoorStaffCards.vue', import.meta.url), 'utf8'),
]);

test('病房内其他医护只展示主任医生和护士长', () => {
  assert.match(wardPanel, /otherCareStaff/);
  assert.match(wardPanel, /bedDeviceInfo[\s\S]*?deptDirectorName/);
  assert.match(wardPanel, /areaHeadNurseName/);
  assert.match(wardPanel, /:other-care-staff="otherCareStaff"/);

  assert.match(staffPanel, /otherCareStaff/);
  assert.match(staffPanel, /主任医生/);
  assert.match(staffPanel, /护士长/);
  assert.match(staffPanel, /other-care-card/);
  assert.match(wardPanel, /placeholderLabel:\s*'医'\s+as const/);
  assert.match(wardPanel, /placeholderLabel:\s*'护'\s+as const/);
});

test('存在病房内其他医护时不再渲染门口机人员和普通人员列表', () => {
  assert.match(staffPanel, /hasOtherCareStaff/);
  assert.match(staffPanel, /hasManagedCareStaff \|\| hasOtherCareStaff/);
  assert.match(staffPanel, /otherDisplayStaff[\s\S]*?hasOtherCareStaff\.value[\s\S]*?\[\]/);
  assert.match(staffPanel, /visibleDeptUsers[\s\S]*?hasOtherCareStaff\.value[\s\S]*?\[\]/);
});
