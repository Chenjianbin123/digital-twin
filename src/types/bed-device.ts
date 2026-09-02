/** 对齐主项目 api-client/src/models/bed-device-info.ts。 */
export interface BedDeviceInfoVo {
  areaCode: string;
  areaId: number;
  areaName: string;
  bedCode: string;
  bedDoctorName?: string;
  bedId: number;
  bedName: string;
  deptCode: string;
  deptDirectorName?: string;
  deptId: number;
  deptName: string;
  deviceCode: string;
  deviceGatewayAddress?: string;
  deviceIp: string;
  deviceName: string;
  deviceSubnetMask?: string;
  deviceTypeCode: string;
  dutyNurseName?: string;
  id: number;
  isOnline?: string;
  sickroomCode: string;
  sickroomId: number;
  sickroomName: string;
  templateId?: number;
  [key: string]: unknown;
}

/** 床头机接口中的患者对象。字段保持原始命名，便于模板 key 直接读取。 */
export interface BedSickInfoVo {
  areaHeadNurseName?: string;
  areaName?: string;
  bedCode?: string;
  bedDoctorName?: string;
  bedName?: string;
  careName?: string;
  deptDirectorName?: string;
  deptName?: string;
  diagnosisName?: string;
  dutyNurseName?: string;
  dutyNurseSynopsis?: string;
  extendColumn1?: string;
  extendColumn2?: string;
  extendColumn3?: string;
  extendColumn4?: string;
  hospitalizationDays?: string;
  is_show_birthday_icon?: '1' | '0' | string;
  nucleicAcidResult?: string;
  nursingColor?: string;
  nursingLevel?: string;
  operationStatus?: string;
  qrCode?: string;
  sickAge?: string;
  sickAllergy?: string;
  sickBirthday?: string;
  sickBloodType?: string;
  sickCondition?: string;
  sickDiet?: string;
  sickIdentifier?: string;
  sickInTime?: string;
  sickIsolation?: string;
  sickName?: string;
  sickName2?: string;
  sickNo?: string;
  sickSafetyPrecautions?: string;
  sickSerialNo?: string;
  sickSex?: string;
  sickSex2?: string;
  sickType?: string;
  visitDoctorName?: string;
  visitDoctorSynopsis?: string;
  [key: string]: unknown;
}

export interface BedSickNursingLabelItem {
  id?: number;
  labelCode: string;
  labelColor: string;
  labelName: string;
  labelPic?: string;
  labelTextColor?: string;
  sort?: string | number;
  [key: string]: unknown;
}

export interface BedDeviceInfoData {
  bedDeviceInfoVo: BedDeviceInfoVo;
  bedSickInfoVo?: BedSickInfoVo | null;
  bedSickNursingLabelList?: BedSickNursingLabelItem[] | null;
  menuInfoDto?: unknown;
  licenseMenuInfo?: unknown;
  callGroupList?: unknown;
  callGroupTimeOutList?: unknown;
  callModeList?: unknown;
  offlineLinkageDeviceList?: unknown;
  [key: string]: unknown;
}

export interface BedDeviceInfoRequestParams {
  deviceCode: string;
  apkSystemType: string;
  menuMode?: string;
}
