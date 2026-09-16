import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBedDeviceInfoToTwinBed } from '../src/core/bed-device-mapping.ts';

function transition(next) {
  const bed = { bedCode: '1', bedName: '1', deviceCode: 'SN1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true };
  const device = { deviceCode: 'SN1', bedCode: '1', bedName: '1' };
  applyBedDeviceInfoToTwinBed(bed, { bedDeviceInfoVo: device, bedSickInfoVo: { sickNo: 'P1', sickName: '患者甲', visitDoctorName: '医生甲', dutyNurseName: '护士甲', visitDoctorUserPic: '/user/doctor.jpg', dutyNurseUserPic: '/user/nurse.jpg' } });
  applyBedDeviceInfoToTwinBed(bed, { bedDeviceInfoVo: device, bedSickInfoVo: next });
  return bed.sickInfo;
}

test('new patient cannot inherit previous patient staff portraits', () => {
  const sick = transition({ sickNo: 'P2', sickName: '患者乙', visitDoctorName: '医生甲', dutyNurseName: '护士甲' });
  assert.equal(sick.visitDoctorUserPic, '');
  assert.equal(sick.dutyNurseUserPic, '');
});
test('changed care staff cannot inherit former staff portraits', () => {
  const sick = transition({ sickNo: 'P1', sickName: '患者甲', visitDoctorName: '医生乙', dutyNurseName: '护士乙' });
  assert.equal(sick.visitDoctorUserPic, '');
  assert.equal(sick.dutyNurseUserPic, '');
});
test('unchanged patient and staff can keep verified portraits', () => {
  const sick = transition({ sickNo: 'P1', sickName: '患者甲', visitDoctorName: '医生甲', dutyNurseName: '护士甲' });
  assert.equal(sick.visitDoctorUserPic, '/user/doctor.jpg');
  assert.equal(sick.dutyNurseUserPic, '/user/nurse.jpg');
});

test('patient change clears vitals and infusion but preserves independent call and device state', () => {
  for (const status of ['300', '301', '302', '305', '304', '307', '9']) {
    const bed = { bedCode: '1', bedName: '1', deviceCode: 'SN1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: false,
      sickInfo: { sickNo: 'P1', sickName: '患者甲' }, latestVitals: { temp: '39', recordTime: 'old' }, isCalling: true,
      statusBarInfo: { bedCode: '1', deviceCode: 'SN1', status } };
    applyBedDeviceInfoToTwinBed(bed, { bedDeviceInfoVo: { deviceCode: 'SN1', bedCode: '1' }, bedSickInfoVo: { sickNo: 'P2', sickName: '患者乙' } });
    assert.equal(bed.latestVitals, undefined);
    assert.equal(bed.isCalling, true);
    assert.equal(bed.isOnline, false);
    assert.equal(bed.statusBarInfo?.status, ['300', '301', '302', '305'].includes(status) ? undefined : status);
  }
});
test('same patient refresh retains vitals and active infusion; discharge removes them', () => {
  const bed = { bedCode: '1', bedName: '1', deviceCode: 'SN1', position: { x: 0, z: 0 }, isOccupied: true, isOnline: true,
    sickInfo: { sickNo: 'P1', sickName: '患者甲' }, latestVitals: { temp: '36.5' }, statusBarInfo: { bedCode: '1', status: '300' } };
  const device = { deviceCode: 'SN1', bedCode: '1' };
  applyBedDeviceInfoToTwinBed(bed, { bedDeviceInfoVo: device, bedSickInfoVo: { sickNo: 'P1', sickName: '患者甲', sickIdentifier: 'extra-id' } });
  assert.equal(bed.latestVitals.temp, '36.5'); assert.equal(bed.statusBarInfo.status, '300');
  applyBedDeviceInfoToTwinBed(bed, { bedDeviceInfoVo: device, bedSickInfoVo: null });
  assert.equal(bed.latestVitals, undefined); assert.equal(bed.statusBarInfo, undefined); assert.equal(bed.isOccupied, false);
});
