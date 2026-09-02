import type { TwinBedEntity } from '../../types/twin.ts';
import type { NursingLabelItem } from '../../types/ward.ts';
import { traverseKeyPath } from '../../utils/key-path.ts';

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
  bedDeviceInfoVo: Record<string, unknown> & {
    bedName: string;
    bedCode: string;
    deviceCode: string;
    isOnline: string;
  };
  bedSickInfoVo: Record<string, unknown>;
  bedSickNursingLabelList: NursingLabelItem[];
  timer: { date: string; time: string };
  statusBarInfo: { status: string; text: string };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
}

/** 构造与 ParserV3 相同命名空间的数据对象，保留后端扩展字段。 */
export function buildBedTemplateData(bed: TwinBedEntity): BedTemplateData {
  const sick = bed.sickInfo;
  const rawDevice = asRecord(bed.bedDeviceInfo);
  const rawSick = Object.keys(asRecord(bed.bedSickInfo)).length
    ? asRecord(bed.bedSickInfo)
    : asRecord(sick);
  const now = new Date();

  return {
    bedDeviceInfoVo: {
      ...rawDevice,
      bedName: bed.bedName,
      bedCode: bed.bedCode,
      deviceCode: bed.deviceCode,
      isOnline: bed.isOnline ? '1' : '0',
    },
    bedSickInfoVo: {
      ...rawSick,
      bedName: rawSick.bedName ?? bed.bedName,
      bedCode: rawSick.bedCode ?? bed.bedCode,
      sickName: rawSick.sickName ?? '',
      sickSex: rawSick.sickSex ?? '',
      sickAge: rawSick.sickAge ?? '',
      sickNo: rawSick.sickNo ?? '',
      sickInTime: rawSick.sickInTime ?? '',
      nursingLevel: rawSick.nursingLevel ?? bed.nursingLevel ?? '',
      nursingColor: rawSick.nursingColor ?? bed.nursingColor ?? '',
      sickAllergy: rawSick.sickAllergy ?? '',
      sickDiet: rawSick.sickDiet ?? '',
      sickSafetyPrecautions: rawSick.sickSafetyPrecautions ?? '',
      sickIsolation: rawSick.sickIsolation ?? '',
      visitDoctorName: rawSick.visitDoctorName ?? '',
      dutyNurseName: rawSick.dutyNurseName ?? '',
      areaHeadNurseName: rawSick.areaHeadNurseName ?? '',
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
    const keys = node.key.split(',').map(k => k.trim()).filter(Boolean);
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
    return String(data.bedSickInfoVo.sickName ?? '');
  if (node.id === 'nursingLevel' || node.id === 'careLevelBack')
    return String(data.bedSickInfoVo.nursingLevel ?? '');
  if (node.id === 'patientAge')
    return String(data.bedSickInfoVo.sickAge ?? '');
  if (node.id === 'patientSex' || node.id === 'sickSex')
    return String(data.bedSickInfoVo.sickSex ?? '');
  if (node.id === 'hosNum')
    return String(data.bedSickInfoVo.sickNo ?? '');
  if (node.id === 'hosDate')
    return formatHosDate(String(data.bedSickInfoVo.sickInTime ?? ''));
  if (node.id === 'food')
    return String(data.bedSickInfoVo.sickDiet ?? '');
  if (node.id === 'allergy')
    return String(data.bedSickInfoVo.sickAllergy ?? '');
  if (node.id === 'guard')
    return String(data.bedSickInfoVo.sickSafetyPrecautions ?? data.bedSickInfoVo.sickIsolation ?? '');
  if (node.id === 'nurseName')
    return String(data.bedSickInfoVo.dutyNurseName ?? '');
  if (node.id === 'docName' || node.id === 'visitDoctorName')
    return String(data.bedSickInfoVo.visitDoctorName ?? '');
  if (node.id === 'areaHeadNurseName')
    return String(data.bedSickInfoVo.areaHeadNurseName ?? '');

  return node.text ?? '';
}

export function resolveNursingBackground(bed: TwinBedEntity, nodeId?: string): string | null {
  if (!nodeId)
    return null;
  const color = bed.bedSickInfo?.nursingColor
    || bed.sickInfo?.nursingColor
    || bed.nursingColor;
  if (!color)
    return null;
  if (['nursingLevel', 'careLevelBack', 'nursingLevelColor'].includes(nodeId))
    return String(color);
  return null;
}
