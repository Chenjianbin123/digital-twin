import type { DoorDeviceInfo, DoorSickInfo, StatusCode } from '@/types/ward';

interface RoomConfig {
  id: number;
  deviceCode: string;
  sickroomId: string;
  sickroomName: string;
  sickroomCode: string;
  /** '0' 横屏 '1' 竖屏，对齐主项目 director */
  director?: '0' | '1';
  templateId?: number;
  env: { temp: string; relativeHumid: string; airQuality: string; noiseLevel: string };
  beds: Array<{
    bedName: string;
    bedCode: string;
    deviceCode: string;
    status: StatusCode;
    isOnline: string;
    patient?: Partial<DoorSickInfo> & { sickName: string; nursingColor: string; nursingLevel: string };
  }>;
}

const BASE_DOOR_INFO = {
  deptId: '60',
  deptName: '普通内科',
  deptCode: '4444',
  deptNote: '',
  areaId: 72,
  areaName: '普通内科病区',
  areaCode: '2009',
  areaNote: '',
  deviceTypeCode: '201',
  deviceSubnetMask: '255.255.255.0',
  deviceGatewayAddress: '192.168.6.1',
  templateId: 3,
};

function createPatient(bedName: string, bedCode: string, p: RoomConfig['beds'][0]['patient']): DoorSickInfo {
  return {
    bedName,
    bedCode,
    sickName: p!.sickName,
    sickSex: '男',
    sickAge: '40',
    sickBirthday: '1985-01-01',
    sickNo: `20${bedCode}`,
    sickInTime: '2025-06-01 08:00',
    nursingLevel: p!.nursingLevel,
    nursingColor: p!.nursingColor,
    sickAllergy: '无',
    sickIsolation: '无',
    sickDiet: '普通食物',
    sickSafetyPrecautions: '无',
    visitDoctorName: '唐昊',
    visitDoctorUserDuty: '主治医师',
    visitDoctorUserProfessional: '主任医生',
    dutyNurseUserProfessional: '主任护士',
    visitDoctorUserRemark: '',
    dutyNurseUserRemark: '',
    visitDoctorUserPic: '',
    dutyNurseName: '何杰',
    dutyNurseUserPic: '',
    areaHeadNurseName: '曾说靖',
    areaHeadNurseUserPic: '',
    ...p,
  };
}

export function createRoomFromConfig(config: RoomConfig): DoorDeviceInfo {
  const doorSickInfoList: DoorSickInfo[] = [];
  const bedDeviceList = config.beds.map((bed, i) => {
    if (bed.patient)
      doorSickInfoList.push(createPatient(bed.bedName, bed.bedCode, bed.patient));
    return {
      id: config.id * 10 + i,
      deviceName: `床头机${bed.bedName}号`,
      deviceCode: bed.deviceCode,
      deviceIp: `192.168.6.${100 + i}`,
      deviceTypeId: 3,
      sickroomName: config.sickroomName,
      sickroomCode: config.sickroomCode,
      bedName: bed.bedName,
      bedCode: bed.bedCode,
      bedSort: String(i + 1),
      isOnline: bed.isOnline,
      statusBarInfo: {
        bedCode: bed.bedCode,
        deviceCode: bed.deviceCode,
        status: bed.status,
      },
    };
  });

  return {
    doorDeviceInfo: {
      ...BASE_DOOR_INFO,
      id: config.id,
      deviceName: `普通内科Android门口机${config.sickroomName}`,
      deviceCode: config.deviceCode,
      deviceIp: `192.168.6.${160 + config.id}`,
      sickroomId: config.sickroomId,
      sickroomName: config.sickroomName,
      sickroomCode: config.sickroomCode,
      templateId: config.templateId ?? BASE_DOOR_INFO.templateId,
      director: config.director,
    },
    doorEnvData: config.env,
    bedDeviceList,
    doorSickInfoList,
  };
}

export const ROOM_903 = createRoomFromConfig({
  id: 814,
  deviceCode: 'SN1063',
  sickroomId: '25',
  sickroomName: '903房',
  sickroomCode: '3093',
  director: '1',
  templateId: 797,
  env: { temp: '26.2', relativeHumid: '62%', airQuality: '良', noiseLevel: '45dB' },
  beds: [
    { bedName: '07', bedCode: '90307', deviceCode: 'SN1007', status: '300', isOnline: '1',
      patient: { sickName: '陈*华', nursingLevel: '一级护理', nursingColor: '#4CAF50' } },
    { bedName: '08', bedCode: '90308', deviceCode: 'SN1008', status: '', isOnline: '1',
      patient: { sickName: '刘*芳', nursingLevel: '二级护理', nursingColor: '#03A9F4' } },
    { bedName: '09', bedCode: '90309', deviceCode: 'SN1009', status: '304', isOnline: '0' },
  ],
});

export const ROOM_904 = createRoomFromConfig({
  id: 815,
  deviceCode: 'SN1064',
  sickroomId: '26',
  sickroomName: '904房',
  sickroomCode: '3094',
  env: { temp: '29.5', relativeHumid: '68%', airQuality: '中', noiseLevel: '52dB' },
  beds: [
    { bedName: '10', bedCode: '90410', deviceCode: 'SN1010', status: '300', isOnline: '1',
      patient: { sickName: '周*强', nursingLevel: '特级护理', nursingColor: '#8800FF' } },
    { bedName: '11', bedCode: '90411', deviceCode: 'SN1011', status: '302', isOnline: '1',
      patient: { sickName: '吴*敏', nursingLevel: '一级护理', nursingColor: '#FF5722' } },
    { bedName: '12', bedCode: '90412', deviceCode: 'SN1012', status: '9', isOnline: '1',
      patient: { sickName: '郑*伟', nursingLevel: '二级护理', nursingColor: '#2196F3' } },
  ],
});

const DEMO_PATIENTS = ['陈*宁', '李*安', '王*华', '赵*敏', '周*远', '吴*清', '郑*和', '孙*悦'];
const DEMO_STATUSES: StatusCode[] = ['', '300', '302', '304', '9'];

function createDemoWardRoom(roomNumber: number, index: number): DoorDeviceInfo {
  const roomName = `${roomNumber}房`;
  const firstBedCode = `${roomNumber}01`;
  const secondBedCode = `${roomNumber}02`;
  const isVacantRoom = roomNumber === 306 || roomNumber === 310;
  const firstStatus = DEMO_STATUSES[index % DEMO_STATUSES.length];
  const firstOnline = roomNumber === 305 ? '0' : '1';
  const director = index % 3 === 0 ? '0' : '1';
  return createRoomFromConfig({
    id: 900 + index,
    deviceCode: `DOOR-3F-${String(index + 1).padStart(2, '0')}`,
    sickroomId: String(300 + index),
    sickroomName: roomName,
    sickroomCode: `3F${String(index + 1).padStart(2, '0')}`,
    director,
    templateId: director === '0' ? 3 : 797,
    env: {
      temp: `${23 + (index % 4)}.${index % 6}`,
      relativeHumid: `${48 + index * 2}%`,
      airQuality: index % 4 === 3 ? '良' : '优',
      noiseLevel: `${36 + index}dB`,
    },
    beds: isVacantRoom
      ? [
          { bedName: '01', bedCode: firstBedCode, deviceCode: `BED-${firstBedCode}`, status: '', isOnline: '1' },
          { bedName: '02', bedCode: secondBedCode, deviceCode: `BED-${secondBedCode}`, status: '', isOnline: '1' },
        ]
      : [
          {
            bedName: '01',
            bedCode: firstBedCode,
            deviceCode: `BED-${firstBedCode}`,
            status: firstStatus,
            isOnline: firstOnline,
            patient: {
              sickName: DEMO_PATIENTS[index % DEMO_PATIENTS.length],
              nursingLevel: index % 3 === 0 ? '一级护理' : '二级护理',
              nursingColor: index % 3 === 0 ? '#FF5722' : '#2196F3',
            },
          },
          { bedName: '02', bedCode: secondBedCode, deviceCode: `BED-${secondBedCode}`, status: '', isOnline: '1' },
        ],
  });
}

export const ROOMS_301_310 = Array.from(
  { length: 10 },
  (_, index) => createDemoWardRoom(301 + index, index),
);
