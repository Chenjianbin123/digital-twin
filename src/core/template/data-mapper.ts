import type { TwinBedEntity } from '@/types/twin';
import type { NursingLabelItem } from '@/types/ward';
import { traverseKeyPath } from '@/utils/key-path';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatHosDate(value: string): string {
  if (!value)
    return '';
  const d = new Date(value.replace(/-/g, '/'));
  if (Number.isNaN(d.getTime()))
    return value;
  return formatDate(d);
}

export function infusionStatusText(status?: string): string {
  switch (status) {
    case '300': return '输液中';
    case '301': return '输液中';
    case '302': return '输液完毕';
    case '305': return '输液完毕';
    case '304': return '设备离线';
    case '307': return '异常离线';
    case '9': return '低电量';
    default: return '';
  }
}

export interface BedTemplateData {
  bedDeviceInfoVo: {
    bedName: string;
    bedCode: string;
    deviceCode: string;
    isOnline: string;
  };
  bedSickInfoVo: Record<string, string>;
  bedSickNursingLabelList: NursingLabelItem[];
  timer: { date: string; time: string };
  statusBarInfo: { status: string; text: string };
}

export function buildBedTemplateData(bed: TwinBedEntity): BedTemplateData {
  const sick = bed.sickInfo;
  const now = new Date();

  return {
    bedDeviceInfoVo: {
      bedName: bed.bedName,
      bedCode: bed.bedCode,
      deviceCode: bed.deviceCode,
      isOnline: bed.isOnline ? '1' : '0',
    },
    bedSickInfoVo: sick
      ? {
          sickName: sick.sickName ?? '',
          sickSex: sick.sickSex ?? '',
          sickAge: sick.sickAge ?? '',
          sickNo: sick.sickNo ?? '',
          sickInTime: sick.sickInTime ?? '',
          nursingLevel: sick.nursingLevel ?? '',
          nursingColor: sick.nursingColor ?? bed.nursingColor ?? '',
          sickAllergy: sick.sickAllergy ?? '',
          sickDiet: sick.sickDiet ?? '',
          sickSafetyPrecautions: sick.sickSafetyPrecautions ?? '',
          sickIsolation: sick.sickIsolation ?? '',
          visitDoctorName: sick.visitDoctorName ?? '',
          dutyNurseName: sick.dutyNurseName ?? '',
          areaHeadNurseName: sick.areaHeadNurseName ?? '',
          sickType: (sick as { sickType?: string }).sickType ?? '',
        }
      : {
          bedName: bed.bedName,
          nursingColor: bed.nursingColor ?? '',
          nursingLevel: bed.nursingLevel ?? '',
        },
    bedSickNursingLabelList: bed.nursingLabels ?? sick?.nursingLabels ?? [],
    timer: {
      date: formatDate(now),
      time: formatTime(now),
    },
    statusBarInfo: {
      status: bed.statusBarInfo?.status ?? '',
      text: infusionStatusText(bed.statusBarInfo?.status),
    },
  };
}

export function resolveNodeText(
  node: { id?: string; key?: string; text?: string },
  data: BedTemplateData,
): string {
  if (node.id === 'bedDeviceStatusBar' || node.id === 'bedDeviceStatus')
    return data.statusBarInfo.text;

  if (typeof node.key === 'string' && node.key.trim()) {
    const keys = node.key.split(',').map(k => k.trim());
    const value = traverseKeyPath(keys, data);
    if (node.id === 'hosDate')
      return formatHosDate(value);
    return value;
  }

  if (node.id === 'date')
    return data.timer.date;
  if (node.id === 'time')
    return data.timer.time;
  if (node.id === 'bedNum' || node.id === 'bedName')
    return data.bedDeviceInfoVo.bedName;
  if (node.id === 'patientName')
    return data.bedSickInfoVo.sickName ?? '';
  if (node.id === 'nursingLevel' || node.id === 'careLevelBack')
    return data.bedSickInfoVo.nursingLevel ?? '';
  if (node.id === 'patientAge')
    return data.bedSickInfoVo.sickAge ?? '';
  if (node.id === 'patientSex' || node.id === 'sickSex')
    return data.bedSickInfoVo.sickSex ?? '';
  if (node.id === 'hosNum')
    return data.bedSickInfoVo.sickNo ?? '';
  if (node.id === 'hosDate')
    return formatHosDate(data.bedSickInfoVo.sickInTime ?? '');
  if (node.id === 'food')
    return data.bedSickInfoVo.sickDiet ?? '';
  if (node.id === 'allergy')
    return data.bedSickInfoVo.sickAllergy ?? '';
  if (node.id === 'guard')
    return data.bedSickInfoVo.sickSafetyPrecautions ?? data.bedSickInfoVo.sickIsolation ?? '';
  if (node.id === 'nurseName')
    return data.bedSickInfoVo.dutyNurseName ?? '';
  if (node.id === 'docName' || node.id === 'visitDoctorName')
    return data.bedSickInfoVo.visitDoctorName ?? '';
  if (node.id === 'areaHeadNurseName')
    return data.bedSickInfoVo.areaHeadNurseName ?? '';

  return node.text ?? '';
}

export function resolveNursingBackground(bed: TwinBedEntity, nodeId?: string): string | null {
  if (!nodeId)
    return null;
  const color = bed.sickInfo?.nursingColor ?? bed.nursingColor;
  if (!color)
    return null;
  if (['nursingLevel', 'careLevelBack', 'nursingLevelColor'].includes(nodeId))
    return color;
  return null;
}
