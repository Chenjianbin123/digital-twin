import type { RoomSummary } from '@/core/area-summary';
import { infusionStatusText } from '@/core/template/data-mapper';
import type { TwinWardEntity } from '@/types/twin';
import type { DoorSickInfo, StatusBarInfo } from '@/types/ward';
import { traverseKeyPath } from '@/utils/key-path';

const WEEK_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())} : ${pad2(date.getMinutes())}`;
}

function formatEnvTemp(value?: string | number): string {
  if (value === undefined || value === '')
    return '';
  const str = String(value);
  return str.includes('℃') ? str : `${str}℃`;
}

function formatEnvHumid(value?: string): string {
  if (!value)
    return '';
  return value.includes('%') ? value : `${value}%`;
}

import { maskSickName } from '@/utils/mask-patient';

function buildBedNum(room: TwinWardEntity): string {
  const beds = room.beds;
  if (!beds.length)
    return '';
  const fmt = (n: string) => (n.includes('床') ? n : `${n}床`);
  if (beds.length === 1)
    return fmt(beds[0].bedName);
  return `${fmt(beds[0].bedName)}-${fmt(beds[beds.length - 1].bedName)}`;
}

function emptySickInfo(bedName: string): DoorSickInfo {
  return {
    bedCode: '',
    bedName,
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
  };
}

export interface DoorBedDeviceVo {
  bedName: string;
  bedCode: string;
  deviceCode: string;
  isOnline: string;
  sickInfo: DoorSickInfo;
  statusBarInfo?: StatusBarInfo;
}

export interface DoorTemplateData {
  bedNum: string;
  doorEnvData: {
    temp: string;
    relativeHumid: string;
    airQuality: string;
    noiseLevel: string;
  };
  doorDeviceInfo: {
    sickroomName: string;
    sickroomCode: string;
    deviceCode: string;
    areaName: string;
    deptName: string;
  };
  bedDeviceList: DoorBedDeviceVo[];
  timer: { date: string; time: string; week: string };
}

export function buildDoorTemplateData(
  room: TwinWardEntity,
  _summary: RoomSummary,
  areaMeta?: { areaName?: string; deptName?: string },
): DoorTemplateData {
  const now = new Date();
  const env = room.doorEnvData;

  const bedDeviceList: DoorBedDeviceVo[] = room.beds.map((bed) => {
    const sick = bed.sickInfo;
    const occupied = bed.isOccupied && sick?.sickNo;
    return {
      bedName: bed.bedName,
      bedCode: bed.bedCode,
      deviceCode: bed.deviceCode,
      isOnline: bed.isOnline ? '1' : '0',
      sickInfo: occupied && sick
        ? { ...sick, sickName: maskSickName(sick.sickName) }
        : emptySickInfo(bed.bedName),
      statusBarInfo: bed.statusBarInfo,
    };
  });

  return {
    bedNum: buildBedNum(room),
    doorEnvData: {
      temp: formatEnvTemp(env?.temp),
      relativeHumid: formatEnvHumid(env?.relativeHumid),
      airQuality: env?.airQuality ?? '',
      noiseLevel: env?.noiseLevel ?? '',
    },
    doorDeviceInfo: {
      sickroomName: room.sickroomName,
      sickroomCode: room.sickroomCode,
      deviceCode: room.deviceCode,
      areaName: areaMeta?.areaName ?? '',
      deptName: areaMeta?.deptName ?? '',
    },
    bedDeviceList,
    timer: {
      date: formatDate(now),
      time: formatTime(now),
      week: WEEK_DAYS[now.getDay()],
    },
  };
}

function resolveEnvNodeText(id: string | undefined, data: DoorTemplateData): string {
  if (!id?.startsWith('doorEnvInfo-'))
    return '';
  if (id.includes('temp'))
    return data.doorEnvData.temp;
  if (id.includes('relativeHumid'))
    return data.doorEnvData.relativeHumid;
  if (id.includes('airQuality'))
    return data.doorEnvData.airQuality;
  return '';
}

export function resolveDoorNursingBackground(
  node: { id?: string },
  data: DoorTemplateData,
  index?: number,
): string | null {
  if (node.id !== 'bedName' || index === undefined)
    return null;
  const color = data.bedDeviceList[index]?.sickInfo?.nursingColor;
  return color || null;
}

export function resolveDoorNodeText(
  node: { id?: string; key?: string; text?: string },
  data: DoorTemplateData,
  index?: number,
): string {
  const envText = resolveEnvNodeText(node.id, data);
  if (envText)
    return envText;

  if (node.id === 'bedDeviceStatusBar' || node.id === 'bedDeviceStatus') {
    if (index === undefined)
      return '';
    const status = data.bedDeviceList[index]?.statusBarInfo?.status;
    return infusionStatusText(status);
  }

  if (typeof node.key === 'string' && node.key.trim()) {
    const keys = node.key.split(',').map(k => k.trim());
    const value = traverseKeyPath(keys, data, index);
    if (value)
      return value;
  }

  if (node.id === 'date')
    return data.timer.date;
  if (node.id === 'time')
    return data.timer.time;
  if (node.id === 'week')
    return data.timer.week;
  if (node.id === 'bedNum')
    return data.bedNum;
  if (node.id === 'roomNum')
    return data.doorDeviceInfo.sickroomName;
  if (node.id === 'patientName' && index !== undefined)
    return data.bedDeviceList[index]?.sickInfo?.sickName ?? '';
  if (node.id === 'sickName' && index !== undefined) {
    const name = data.bedDeviceList[index]?.sickInfo?.sickName ?? '';
    return name || '空床';
  }

  return node.text ?? '';
}
