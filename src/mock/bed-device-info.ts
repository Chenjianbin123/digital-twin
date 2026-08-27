import type { BedDeviceInfoData } from '@/types/bed-device';

/** 对齐主项目 mock/bed/device-list.ts，按床头机 SN 返回 templateId */
const BED_DEVICE_BY_SN: Record<string, BedDeviceInfoData> = {
  SN1001: {
    bedDeviceInfoVo: {
      id: 752, deviceName: '床头机1号', deviceCode: 'SN1001', deviceIp: '192.168.6.101',
      deviceTypeCode: '102', deptId: 60, deptName: '普通内科', deptCode: '4444',
      areaId: 72, areaName: '普通内科病区', areaCode: '2009',
      sickroomId: 23, sickroomName: '901房', sickroomCode: '3091',
      bedName: '01', bedId: 41, bedCode: '90101', templateId: 1,
    },
  },
  SN1002: {
    bedDeviceInfoVo: {
      id: 753, deviceName: '床头机2号', deviceCode: 'SN1002', deviceIp: '192.168.6.102',
      deviceTypeCode: '102', deptId: 60, deptName: '普通内科', deptCode: '4444',
      areaId: 72, areaName: '普通内科病区', areaCode: '2009',
      sickroomId: 23, sickroomName: '901房', sickroomCode: '3091',
      bedName: '02', bedId: 42, bedCode: '90102', templateId: 1,
    },
  },
  SN1003: {
    bedDeviceInfoVo: {
      id: 754, deviceName: '床头机3号', deviceCode: 'SN1003', deviceIp: '192.168.6.103',
      deviceTypeCode: '102', deptId: 60, deptName: '普通内科', deptCode: '4444',
      areaId: 72, areaName: '普通内科病区', areaCode: '2009',
      sickroomId: 23, sickroomName: '901房', sickroomCode: '3091',
      bedName: '03', bedId: 43, bedCode: '90103', templateId: 1,
    },
  },
  SN1004: {
    bedDeviceInfoVo: {
      id: 755, deviceName: '床头机4号', deviceCode: 'SN1004', deviceIp: '192.168.6.104',
      deviceTypeCode: '102', deptId: 60, deptName: '普通内科', deptCode: '4444',
      areaId: 72, areaName: '普通内科病区', areaCode: '2009',
      sickroomId: 23, sickroomName: '901房', sickroomCode: '3091',
      bedName: '04', bedId: 44, bedCode: '90104', templateId: 1,
    },
  },
};

export function getMockBedDeviceInfo(deviceCode: string): BedDeviceInfoData | null {
  if (BED_DEVICE_BY_SN[deviceCode])
    return structuredClone(BED_DEVICE_BY_SN[deviceCode]);
  return {
    bedDeviceInfoVo: {
      id: 0,
      deviceName: deviceCode,
      deviceCode,
      deviceIp: '',
      deviceTypeCode: '102',
      deptId: 0,
      deptName: '',
      deptCode: '',
      areaId: 0,
      areaName: '',
      areaCode: '',
      sickroomId: 0,
      sickroomName: '',
      sickroomCode: '',
      bedName: '',
      bedId: 0,
      bedCode: '',
      templateId: 1,
    },
  };
}
