/** 自研输液状态码（与智慧病房床头机/门口机保持一致） */
export type StatusCode = '300' | '301' | '302' | '305' | '304' | '307' | '9' | '';

/** 自研输液设备状态（仅 status 状态码驱动） */
export interface StatusBarInfo {
  bedCode: string;
  deviceCode: string;
  status: StatusCode;
}

export interface DoorEnvParams {
  temp?: string | number;
  relativeHumid?: string;
  airQuality?: string;
  noiseLevel?: string;
}

export interface NursingLabelItem {
  labelCode: string;
  labelName: string;
  labelColor: string;
  labelTextColor?: string;
}

export interface DoorSickInfo {
  bedCode: string;
  bedName: string;
  sickName: string;
  sickSex: string;
  sickAge: string;
  sickBirthday: string;
  sickNo: string;
  sickInTime: string;
  nursingLevel: string;
  nursingColor: string;
  sickAllergy: string;
  sickIsolation: string;
  sickDiet: string;
  sickSafetyPrecautions: string;
  visitDoctorName: string;
  visitDoctorUserDuty: string;
  visitDoctorUserProfessional: string;
  dutyNurseName: string;
  dutyNurseUserProfessional: string;
  visitDoctorUserRemark: string;
  dutyNurseUserRemark: string;
  visitDoctorUserPic: string;
  dutyNurseUserPic: string;
  areaHeadNurseName: string;
  areaHeadNurseUserPic: string;
  nursingLabels?: NursingLabelItem[];
  /** 原始床头机患者字段，门口机数据没有时保持为空。 */
  [key: string]: unknown;
}

export interface BedDevice {
  id: number;
  deviceName: string;
  deviceCode: string;
  deviceIp: string;
  deviceTypeId: number;
  sickroomName: string;
  sickroomCode: string;
  bedName: string;
  bedCode: string;
  bedSort: string;
  isOnline: string;
  statusBarInfo?: StatusBarInfo;
}

export interface DoorDeptUser {
  userRealname: string;
  userPic?: string;
  userProfessional?: string;
  userDuty?: string;
}

export interface DoorMainStaff {
  areaDirectorName?: string;
  areaDirectorUserPic?: string;
  areaHeadNurseName?: string;
  areaHeadNurseUserPic?: string;
  deptDirectorName?: string;
  deptDirectorUserPic?: string;
}

export interface DoorDeviceInfo {
  doorDeviceInfo: {
    areaCode: string;
    areaId: number;
    areaName: string;
    areaNote: string;
    deptCode: string;
    deptId: string;
    deptName: string;
    deptNote: string;
    deviceCode: string;
    deviceGatewayAddress: string;
    deviceIp: string;
    deviceName: string;
    deviceSubnetMask: string;
    deviceTypeCode: string;
    /** 设备在线状态，未返回时保持 undefined */
    isOnline?: string;
    id: number;
    sickroomCode: string;
    sickroomId: string;
    sickroomName: string;
    templateId: number;
    /** 设备横竖屏：'0' 横屏，'1' 竖屏 */
    director?: '0' | '1';
  };
  bedDeviceList: BedDevice[];
  doorSickInfoList: DoorSickInfo[];
  doorDeptUserList?: DoorDeptUser[];
  doorMainDoctorAndNurseVo?: DoorMainStaff;
  doorEnvData?: DoorEnvParams;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
