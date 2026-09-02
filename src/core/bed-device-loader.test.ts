import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDoorDevice } from '../api/normalize-door.ts';
import {
  applyBedDeviceInfoToTwinBed,
  isBedDeviceResponseApplicable,
  shouldWarnForMissingBedDevice,
} from './bed-device-mapping.ts';
import { mapDoorDeviceToTwinWard } from '../types/twin.ts';
import type { BedDeviceInfoData } from '../types/bed-device.ts';
import type { TwinBedEntity } from '../types/twin.ts';

function createTwinBed(): TwinBedEntity {
  return {
    bedCode: '90101',
    bedName: '01',
    deviceCode: 'SN1001',
    position: { x: 0, z: 0 },
    isOccupied: false,
    isOnline: true,
  };
}

test('maps bed terminal patient and nursing labels from bed endpoint data', () => {
  const bed = createTwinBed();
  const data: BedDeviceInfoData = {
    bedDeviceInfoVo: {
      id: 752,
      deviceName: '床头机1号',
      deviceCode: 'SN1001',
      deviceIp: '192.168.6.101',
      deviceTypeCode: '102',
      deptId: 60,
      deptName: '普通内科',
      deptCode: '4444',
      areaId: 72,
      areaName: '普通内科病区',
      areaCode: '2009',
      sickroomId: 23,
      sickroomName: '901房',
      sickroomCode: '3091',
      bedName: '01',
      bedId: 41,
      bedCode: '90101',
      templateId: 42,
      isOnline: '1',
    },
    bedSickInfoVo: {
      sickName: '床头患者',
      sickNo: 'A-1',
      nursingLevel: '一级护理',
      nursingColor: '#ff0000',
      sickSex: '男',
      sickAge: '68',
      sickInTime: '2026-08-01 10:20',
    },
    bedSickNursingLabelList: [
      { id: 1, labelCode: 'fall', labelName: '防跌倒', labelColor: '#ff9800', labelTextColor: '#ffffff' },
    ],
  };

  const result = applyBedDeviceInfoToTwinBed(bed, data);

  assert.equal(result.templateId, 42);
  assert.equal(result.sickInfo?.sickName, '床头患者');
  assert.equal(result.sickInfo?.sickNo, 'A-1');
  assert.deepEqual(result.nursingLabels?.map(item => item.labelCode), ['fall']);
  assert.equal(result.nursingColor, '#ff0000');
  assert.equal(result.nursingLevel, '一级护理');
  assert.equal(result.isOccupied, true);
  assert.equal(result.isOnline, true);
});

test('clears stale patient fields when the bed endpoint reports an empty bed', () => {
  const bed = {
    ...createTwinBed(),
    isOccupied: true,
    sickInfo: {
      bedCode: '90101',
      bedName: '01',
      sickName: '旧患者',
      sickSex: '男',
      sickAge: '40',
      sickBirthday: '',
      sickNo: 'OLD',
      sickInTime: '',
      nursingLevel: '一级护理',
      nursingColor: '#f00',
      sickAllergy: '',
      sickIsolation: '',
      sickDiet: '',
      sickSafetyPrecautions: '',
      visitDoctorName: '',
      visitDoctorUserDuty: '',
      visitDoctorUserProfessional: '',
      dutyNurseName: '',
      dutyNurseUserProfessional: '',
      visitDoctorUserRemark: '',
      dutyNurseUserRemark: '',
      visitDoctorUserPic: '',
      dutyNurseUserPic: '',
      areaHeadNurseName: '',
      areaHeadNurseUserPic: '',
    },
    nursingLabels: [{ labelCode: 'old', labelName: '旧标签', labelColor: '#f00' }],
  };

  applyBedDeviceInfoToTwinBed(bed, {
    bedDeviceInfoVo: {
      id: 752,
      deviceName: '床头机1号',
      deviceCode: 'SN1001',
      deviceIp: '',
      deviceTypeCode: '102',
      deptId: 60,
      deptName: '',
      deptCode: '',
      areaId: 72,
      areaName: '',
      areaCode: '',
      sickroomId: 23,
      sickroomName: '901房',
      sickroomCode: '3091',
      bedName: '01',
      bedId: 41,
      bedCode: '90101',
      templateId: 42,
      isOnline: '1',
    },
    bedSickInfoVo: null,
    bedSickNursingLabelList: [],
  });

  assert.equal(bed.isOccupied, false);
  assert.equal(bed.sickInfo, undefined);
  assert.deepEqual(bed.nursingLabels, []);
  assert.equal(bed.nursingColor, undefined);
  assert.equal(bed.nursingLevel, undefined);
});

test('does not apply a stale or mismatched bed endpoint response', () => {
  const bed = createTwinBed();
  const response = {
    bedDeviceInfoVo: {
      id: 900,
      deviceName: '另一台床头机',
      deviceCode: 'SN-OTHER',
      deviceIp: '',
      deviceTypeCode: '102',
      deptId: 1,
      deptName: '测试病区',
      deptCode: 'TEST',
      areaId: 1,
      areaName: '测试病区',
      areaCode: 'TEST',
      sickroomId: 1,
      sickroomName: '101房',
      sickroomCode: '101',
      bedName: '02',
      bedId: 2,
      bedCode: '10102',
      templateId: 88,
    },
    bedSickInfoVo: {
      sickName: '不应覆盖',
    },
    bedSickNursingLabelList: [],
  } satisfies BedDeviceInfoData;

  bed.deviceCode = 'SN1002';
  assert.equal(isBedDeviceResponseApplicable(bed, 'SN1001', response), false);
});

test('normalizes a bed terminal SN when the door payload uses a supported alias', () => {
  const normalized = normalizeDoorDevice({
    bedDeviceList: [{
      bedCode: '90101',
      bedName: '01',
      deviceSn: 'SN-90101',
    }],
  });

  assert.equal(normalized.bedDeviceList[0]?.deviceCode, 'SN-90101');
});

test('does not warn for a vacant bed without a terminal binding', () => {
  assert.equal(shouldWarnForMissingBedDevice({
    deviceCode: '',
    isOccupied: false,
  }), false);
});

test('warns when an occupied bed has no terminal binding', () => {
  assert.equal(shouldWarnForMissingBedDevice({
    deviceCode: '',
    isOccupied: true,
  }), true);
});

test('does not warn for a placeholder empty-bed label even if occupancy is stale', () => {
  assert.equal(shouldWarnForMissingBedDevice({
    bedName: '空床',
    deviceCode: '',
    isOccupied: true,
  }), false);
});

test('treats a placeholder empty-patient record as a vacant bed', () => {
  const ward = mapDoorDeviceToTwinWard({
    doorDeviceInfo: {
      id: 1,
      deviceName: '门口机',
      deviceCode: 'DOOR-901',
      deviceIp: '',
      deviceTypeCode: '201',
      deviceSubnetMask: '',
      deviceGatewayAddress: '',
      deptId: '60',
      deptName: '普通内科',
      deptCode: '4444',
      deptNote: '',
      areaId: 72,
      areaName: '普通内科病区',
      areaCode: '2009',
      areaNote: '',
      sickroomId: '23',
      sickroomName: '901房',
      sickroomCode: '3091',
      templateId: 3,
    },
    bedDeviceList: [{
      id: 1,
      deviceName: '床头机',
      deviceCode: '',
      deviceIp: '',
      deviceTypeId: 3,
      sickroomName: '901房',
      sickroomCode: '3091',
      bedName: '空床',
      bedCode: '90101',
      bedSort: '1',
      isOnline: '0',
    }],
    doorSickInfoList: [{
      bedCode: '90101',
      bedName: '空床',
      sickName: '',
      sickSex: '',
      sickAge: '',
      sickBirthday: '',
      sickNo: '',
      sickInTime: '',
      nursingLevel: '',
      nursingColor: '',
      sickAllergy: '',
      sickIsolation: '',
      sickDiet: '',
      sickSafetyPrecautions: '',
      visitDoctorName: '',
      visitDoctorUserDuty: '',
      visitDoctorUserProfessional: '',
      dutyNurseName: '',
      dutyNurseUserProfessional: '',
      visitDoctorUserRemark: '',
      dutyNurseUserRemark: '',
      visitDoctorUserPic: '',
      dutyNurseUserPic: '',
      areaHeadNurseName: '',
      areaHeadNurseUserPic: '',
    }],
  });

  assert.equal(ward.beds[0]?.isOccupied, false);
  assert.equal(ward.beds[0]?.sickInfo, undefined);
});
