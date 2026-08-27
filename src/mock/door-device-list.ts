import type { ApiResponse, DoorDeviceInfo } from '@/types/ward';
import { ROOM_903, ROOM_904, ROOMS_301_310 } from './room-factory';

/** 结构对齐 medical-device-v2/src/api-client/src/mock/door/device-list.ts */
const ROOM_901: DoorDeviceInfo = {
  doorDeviceInfo: {
    id: 812,
    deviceName: '普通内科Android门口机1号',
    deviceCode: 'SN1061',
    deviceIp: '192.168.6.161',
    deviceTypeCode: '201',
    deviceSubnetMask: '255.255.255.0',
    deviceGatewayAddress: '192.168.6.1',
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
  doorEnvData: { temp: '24.5', relativeHumid: '55%', airQuality: '优', noiseLevel: '42dB' },
  bedDeviceList: [
    {
      id: 752, deviceName: '床头机1号', deviceCode: 'SN1001', deviceIp: '192.168.6.101', deviceTypeId: 3,
      sickroomName: '901房', sickroomCode: '3091', bedName: '01', bedCode: '90101', bedSort: '1', isOnline: '1',
      statusBarInfo: { bedCode: '90101', deviceCode: 'SN1001', status: '300' },
    },
    {
      id: 753, deviceName: '床头机2号', deviceCode: 'SN1002', deviceIp: '192.168.6.102', deviceTypeId: 3,
      sickroomName: '901房', sickroomCode: '3091', bedName: '02', bedCode: '90102', bedSort: '2', isOnline: '1',
      statusBarInfo: { bedCode: '90102', deviceCode: 'SN1002', status: '302' },
    },
    {
      id: 754, deviceName: '床头机3号', deviceCode: 'SN1003', deviceIp: '192.168.6.103', deviceTypeId: 3,
      sickroomName: '901房', sickroomCode: '3091', bedName: '03', bedCode: '90103', bedSort: '3', isOnline: '1',
      statusBarInfo: { bedCode: '90103', deviceCode: 'SN1003', status: '' },
    },
    {
      id: 755, deviceName: '床头机4号', deviceCode: 'SN1004', deviceIp: '192.168.6.104', deviceTypeId: 3,
      sickroomName: '901房', sickroomCode: '3091', bedName: '04', bedCode: '90104', bedSort: '4', isOnline: '0',
      statusBarInfo: { bedCode: '90104', deviceCode: 'SN1004', status: '304' },
    },
  ],
  doorSickInfoList: [
    {
      bedName: '01', bedCode: '90101', sickName: '杨*合', sickSex: '男', sickAge: '21',
      sickBirthday: '2003-09-23', sickNo: '20001', sickInTime: '2025-06-01 10:12',
      nursingLevel: '特级护理', nursingColor: '#8800FF', sickAllergy: '青霉素', sickIsolation: '空气隔离',
      sickDiet: '普通食物', sickSafetyPrecautions: '防止药液外渗', visitDoctorName: '唐昊',
      visitDoctorUserDuty: '主治医师', visitDoctorUserProfessional: '主任医生',
      dutyNurseUserProfessional: '主任护士', visitDoctorUserRemark: '', dutyNurseUserRemark: '',
      visitDoctorUserPic: '', dutyNurseName: '何杰', dutyNurseUserPic: '',
      areaHeadNurseName: '曾说靖', areaHeadNurseUserPic: '',
      nursingLabels: [
        { labelCode: 'isolation', labelName: '隔离', labelColor: '#FF5722', labelTextColor: '#fff' },
        { labelCode: 'fall', labelName: '防跌倒', labelColor: '#FFC107', labelTextColor: '#333' },
      ],
    },
    {
      bedName: '02', bedCode: '90102', sickName: '李*伊', sickSex: '男', sickAge: '68',
      sickBirthday: '1957-03-17', sickNo: '20002', sickInTime: '2025-06-02 14:30',
      nursingLevel: '一级护理', nursingColor: '#FF5722', sickAllergy: '头孢', sickIsolation: '保护隔离',
      sickDiet: '流食', sickSafetyPrecautions: '防止药物外渗', visitDoctorName: '唐昊',
      visitDoctorUserDuty: '主治医师', visitDoctorUserProfessional: '主任医生',
      dutyNurseUserProfessional: '主任护士', visitDoctorUserRemark: '', dutyNurseUserRemark: '',
      visitDoctorUserPic: '', dutyNurseName: '何杰', dutyNurseUserPic: '',
      areaHeadNurseName: '曾说靖', areaHeadNurseUserPic: '',
      nursingLabels: [{ labelCode: 'infusion', labelName: '输液', labelColor: '#2196F3', labelTextColor: '#fff' }],
    },
    {
      bedName: '03', bedCode: '90103', sickName: '杨*芳', sickSex: '女', sickAge: '25',
      sickBirthday: '2000-02-24', sickNo: '20003', sickInTime: '2025-06-03 09:00',
      nursingLevel: '二级护理', nursingColor: '#2196F3', sickAllergy: '无', sickIsolation: '飞沫隔离',
      sickDiet: '流食', sickSafetyPrecautions: '防止坠床跌落', visitDoctorName: '万金玉',
      visitDoctorUserDuty: '主治医师', visitDoctorUserProfessional: '主任医生',
      dutyNurseUserProfessional: '主任护士', visitDoctorUserRemark: '', dutyNurseUserRemark: '',
      visitDoctorUserPic: '', dutyNurseName: '何杰', dutyNurseUserPic: '',
      areaHeadNurseName: '曾说靖', areaHeadNurseUserPic: '',
    },
  ],
};

const ROOM_902: DoorDeviceInfo = {
  doorDeviceInfo: {
    id: 813,
    deviceName: '普通内科Android门口机2号',
    deviceCode: 'SN1062',
    deviceIp: '192.168.6.162',
    deviceTypeCode: '201',
    deviceSubnetMask: '255.255.255.0',
    deviceGatewayAddress: '192.168.6.1',
    deptId: '60',
    deptName: '普通内科',
    deptCode: '4444',
    deptNote: '',
    areaId: 72,
    areaName: '普通内科病区',
    areaCode: '2009',
    areaNote: '',
    sickroomId: '24',
    sickroomName: '902房',
    sickroomCode: '3092',
    templateId: 3,
  },
  doorEnvData: { temp: '23.8', relativeHumid: '58%', airQuality: '良', noiseLevel: '38dB' },
  bedDeviceList: [
    {
      id: 756, deviceName: '床头机5号', deviceCode: 'SN1005', deviceIp: '192.168.6.105', deviceTypeId: 3,
      sickroomName: '902房', sickroomCode: '3092', bedName: '05', bedCode: '90205', bedSort: '1', isOnline: '1',
      statusBarInfo: { bedCode: '90205', deviceCode: 'SN1005', status: '302' },
    },
    {
      id: 757, deviceName: '床头机6号', deviceCode: 'SN1006', deviceIp: '192.168.6.106', deviceTypeId: 3,
      sickroomName: '902房', sickroomCode: '3092', bedName: '06', bedCode: '90206', bedSort: '2', isOnline: '1',
      statusBarInfo: { bedCode: '90206', deviceCode: 'SN1006', status: '' },
    },
  ],
  doorSickInfoList: [
    {
      bedName: '05', bedCode: '90205', sickName: '王*明', sickSex: '男', sickAge: '45',
      sickBirthday: '1980-05-12', sickNo: '20005', sickInTime: '2025-06-04 08:00',
      nursingLevel: '一级护理', nursingColor: '#4CAF50', sickAllergy: '无', sickIsolation: '无',
      sickDiet: '普通食物', sickSafetyPrecautions: '无', visitDoctorName: '唐昊',
      visitDoctorUserDuty: '主治医师', visitDoctorUserProfessional: '主任医生',
      dutyNurseUserProfessional: '主任护士', visitDoctorUserRemark: '', dutyNurseUserRemark: '',
      visitDoctorUserPic: '', dutyNurseName: '何杰', dutyNurseUserPic: '',
      areaHeadNurseName: '曾说靖', areaHeadNurseUserPic: '',
    },
    {
      bedName: '06', bedCode: '90206', sickName: '赵*丽', sickSex: '女', sickAge: '33',
      sickBirthday: '1992-11-08', sickNo: '20006', sickInTime: '2025-06-05 11:30',
      nursingLevel: '二级护理', nursingColor: '#03A9F4', sickAllergy: '磺胺', sickIsolation: '接触隔离',
      sickDiet: '半流食', sickSafetyPrecautions: '防压疮', visitDoctorName: '万金玉',
      visitDoctorUserDuty: '主治医师', visitDoctorUserProfessional: '主任医生',
      dutyNurseUserProfessional: '主任护士', visitDoctorUserRemark: '', dutyNurseUserRemark: '',
      visitDoctorUserPic: '', dutyNurseName: '何杰', dutyNurseUserPic: '',
      areaHeadNurseName: '曾说靖', areaHeadNurseUserPic: '',
      nursingLabels: [{ labelCode: 'pressure', labelName: '防压疮', labelColor: '#9C27B0', labelTextColor: '#fff' }],
    },
  ],
};

export const MOCK_DOOR_DEVICE_LIST: ApiResponse<DoorDeviceInfo[]> = {
  code: 200,
  message: '操作成功！',
  data: ROOMS_301_310,
};

export { ROOM_901, ROOM_902, ROOM_903, ROOM_904 };
