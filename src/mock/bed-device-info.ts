import type { BedDeviceInfoData } from '@/types/bed-device';
import type { DoorDeviceInfo } from '@/types/ward';
import { MOCK_DOOR_DEVICE_LIST } from './door-device-list';

function buildBedDeviceInfo(room: DoorDeviceInfo, bedCode: string): BedDeviceInfoData | null {
  const bed = room.bedDeviceList.find(item => item.bedCode === bedCode);
  if (!bed)
    return null;
  const patient = room.doorSickInfoList.find(item => item.bedCode === bed.bedCode);
  const labels = patient?.nursingLabels ?? [];

  return {
    bedDeviceInfoVo: {
      id: bed.id,
      deviceName: bed.deviceName,
      deviceCode: bed.deviceCode,
      deviceIp: bed.deviceIp,
      deviceTypeCode: '102',
      deptId: Number(room.doorDeviceInfo.deptId || 0),
      deptName: room.doorDeviceInfo.deptName,
      deptCode: room.doorDeviceInfo.deptCode,
      areaId: room.doorDeviceInfo.areaId,
      areaName: room.doorDeviceInfo.areaName,
      areaCode: room.doorDeviceInfo.areaCode,
      sickroomId: Number(room.doorDeviceInfo.sickroomId || 0),
      sickroomName: room.doorDeviceInfo.sickroomName,
      sickroomCode: room.doorDeviceInfo.sickroomCode,
      bedName: bed.bedName,
      bedId: bed.id,
      bedCode: bed.bedCode,
      templateId: 1,
      isOnline: bed.isOnline,
    },
    bedSickInfoVo: patient
      ? {
          ...patient,
          sickIdentifier: patient.sickNo,
          sickSerialNo: patient.sickNo,
          sickType: '',
        }
      : null,
    bedSickNursingLabelList: labels.map((item, index) => ({
      id: index + 1,
      labelCode: item.labelCode,
      labelName: item.labelName,
      labelColor: item.labelColor,
      labelTextColor: item.labelTextColor,
    })),
  };
}

function findMockBedDeviceInfo(deviceCode: string): BedDeviceInfoData | null {
  for (const room of MOCK_DOOR_DEVICE_LIST.data) {
    const result = buildBedDeviceInfo(room, deviceCode);
    if (result)
      return result;
  }
  return null;
}

/** Mock 也走与真实接口相同的完整床头数据结构。 */
export function getMockBedDeviceInfo(deviceCode: string): BedDeviceInfoData {
  const found = findMockBedDeviceInfo(deviceCode);
  if (found)
    return structuredClone(found);

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
    bedSickInfoVo: null,
    bedSickNursingLabelList: [],
  };
}
