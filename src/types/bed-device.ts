/** 对齐主项目 api-client/src/models/bed-device-info.ts */
export interface BedDeviceInfoVo {
  id: number;
  deviceName: string;
  deviceCode: string;
  deviceIp: string;
  deviceTypeCode: string;
  deptId: number;
  deptName: string;
  deptCode: string;
  areaId: number;
  areaName: string;
  areaCode: string;
  sickroomId: number;
  sickroomName: string;
  sickroomCode: string;
  bedName: string;
  bedId: number;
  bedCode: string;
  templateId: number;
  bedDoctorName?: string;
  dutyNurseName?: string;
}

export interface BedDeviceInfoData {
  bedDeviceInfoVo: BedDeviceInfoVo;
}

export interface BedDeviceInfoRequestParams {
  deviceCode: string;
  apkSystemType: string;
  menuMode?: string;
}
