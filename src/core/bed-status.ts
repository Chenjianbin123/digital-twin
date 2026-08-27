import type { StatusCode } from '@/types/ward';
import type { BedStatusMeta, TwinBedEntity } from '@/types/twin';

/** 自研输液状态码映射 */
const STATUS_MAP: Record<string, BedStatusMeta> = {
  '300': { state: 'infusing', label: '输液中', color: '#FF9800', emissive: '#FF6D00' },
  '301': { state: 'infusing', label: '输液中', color: '#FF9800', emissive: '#FF6D00' },
  '302': { state: 'infused', label: '输液完毕', color: '#00C742', emissive: '#00E676' },
  '305': { state: 'infused', label: '输液完毕', color: '#00C742', emissive: '#00E676' },
  '304': { state: 'offline', label: '设备离线', color: '#FF0004', emissive: '#FF1744' },
  '307': { state: 'offline', label: '异常离线', color: '#FF0004', emissive: '#FF1744' },
  '9': { state: 'lowBattery', label: '低电量', color: '#FF0004', emissive: '#FF1744' },
  '': { state: 'occupied', label: '在院', color: '#4FC3F7', emissive: '#0288D1' },
};

const EMPTY_META: BedStatusMeta = {
  state: 'empty',
  label: '空床',
  color: '#9E9E9E',
  emissive: '#616161',
};

const OCCUPIED_META: BedStatusMeta = {
  state: 'occupied',
  label: '在院',
  color: '#4FC3F7',
  emissive: '#0288D1',
};

const CALLING_META: BedStatusMeta = {
  state: 'calling',
  label: '呼叫中',
  color: '#E91E63',
  emissive: '#FF1744',
};

export function resolveBedStatus(bed: TwinBedEntity): BedStatusMeta {
  if (bed.isCalling)
    return CALLING_META;

  if (!bed.isOccupied)
    return EMPTY_META;

  const status = bed.statusBarInfo?.status;
  // 仅根据输液状态码判断离线/输液中；isOnline 为接口初始值 '0'，不代表输液泵离线
  if (status !== undefined && status !== '' && status in STATUS_MAP)
    return STATUS_MAP[status as StatusCode];

  if (bed.nursingColor) {
    return {
      ...OCCUPIED_META,
      color: bed.nursingColor,
      emissive: bed.nursingColor,
    };
  }

  return OCCUPIED_META;
}

export function getStatusLegend(): BedStatusMeta[] {
  return [
    EMPTY_META,
    OCCUPIED_META,
    STATUS_MAP['300'],
    STATUS_MAP['302'],
    STATUS_MAP['304'],
    STATUS_MAP['9'],
    CALLING_META,
  ];
}
