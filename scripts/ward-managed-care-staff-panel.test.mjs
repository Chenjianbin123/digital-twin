import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [wardPanel, staffPanel, avatar] = await Promise.all([
  readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/DoorStaffCards.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/StaffAvatar.vue', import.meta.url), 'utf8'),
]);

test('病房内医护团队顶部展示主治医生和责任护士', () => {
  assert.match(wardPanel, /managedCareStaff/);
  assert.match(wardPanel, /visitDoctorName/);
  assert.match(wardPanel, /visitDoctorUserPic[\s\S]*?visitDoctorPic/);
  assert.match(wardPanel, /visitDoctorSynopsis[\s\S]*?visitDoctorUserRemark/);
  assert.match(wardPanel, /dutyNurseName/);
  assert.match(wardPanel, /dutyNurseUserPic[\s\S]*?dutyNursePic/);
  assert.match(wardPanel, /dutyNurseSynopsis[\s\S]*?dutyNurseUserRemark/);
  assert.match(wardPanel, /:managed-care-staff="managedCareStaff"/);
  assert.match(staffPanel, /managedCareStaff/);
  assert.match(staffPanel, /主治医生|责任护士/);
});

test('病房内医护团队头像忽略模板和监护图标，避免刷新后覆盖真实头像', () => {
  assert.match(wardPanel, /function isTemplateOrIconImage/);
  assert.match(wardPanel, /function staffPicText/);
  assert.match(wardPanel, /\/template\//);
  assert.match(wardPanel, /\/doorbtn\//);
  assert.match(wardPanel, /monitor\./);
  assert.match(wardPanel, /bedDoctorPic = staffPicText\(\s*sick\.visitDoctorUserPic[\s\S]*?sickRecord\.visitDoctorPic/);
  assert.match(wardPanel, /dutyNursePic = staffPicText\(\s*sick\.dutyNurseUserPic[\s\S]*?sickRecord\.dutyNursePic/);
});

test('主治医生责任护士可点击弹出简介，缺图时使用科技感默认头像', () => {
  assert.match(staffPanel, /placeholder-label/);
  assert.match(staffPanel, /managed-care-card/);
  assert.match(staffPanel, /staffIntroDialog/);
  assert.match(staffPanel, /openStaffIntro/);
  assert.match(staffPanel, /staff-intro-modal/);
  assert.match(staffPanel, /简介|暂无简介/);
  assert.match(staffPanel, /其他医护/);
  assert.match(staffPanel, /normalizedDeptUsers/);
  assert.match(staffPanel, /isMeaningfulDuty/);
  assert.match(staffPanel, /\/\^\\d\+\$\/\.test/);
  assert.match(avatar, /placeholderLabel/);
});
