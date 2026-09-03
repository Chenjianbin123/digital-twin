import type { StatusCode } from '@/types/ward';
import type { BedStatusMeta, TwinBedEntity } from '@/types/twin';

/** 自研输液状态码映射 */
export const WARD_BED_STATUS_COLORS = {
  occupied: { color: '#2FE6A6', emissive: '#00C781' },
  empty: { color: '#8FA3B8', emissive: '#607D8B' },
  calling: { color: '#FF4D8D', emissive: '#FF1744' },
  infusing: { color: '#FFB84D', emissive: '#FF8F00' },
  infused: { color: '#42E88D', emissive: '#00C853' },
  offline: { color: '#FF6B6B', emissive: '#FF3D3D' },
  lowBattery: { color: '#FFD166', emissive: '#FFB300' },
} as const;

const STATUS_MAP: Record<string, BedStatusMeta> = {
  '300': { state: 'infusing', label: '输液中', ...WARD_BED_STATUS_COLORS.infusing },
  '301': { state: 'infusing', label: '输液中', ...WARD_BED_STATUS_COLORS.infusing },
  '302': { state: 'infused', label: '输液完毕', ...WARD_BED_STATUS_COLORS.infused },
  '305': { state: 'infused', label: '输液完毕', ...WARD_BED_STATUS_COLORS.infused },
  '304': { state: 'offline', label: '设备离线', ...WARD_BED_STATUS_COLORS.offline },
  '307': { state: 'offline', label: '异常离线', ...WARD_BED_STATUS_COLORS.offline },
  '9': { state: 'lowBattery', label: '低电量', ...WARD_BED_STATUS_COLORS.lowBattery },
  '': { state: 'occupied', label: '在院', ...WARD_BED_STATUS_COLORS.occupied },
};

const EMPTY_META: BedStatusMeta = {
  state: 'empty',
  label: '空床',
  ...WARD_BED_STATUS_COLORS.empty,
};

const OCCUPIED_META: BedStatusMeta = {
  state: 'occupied',
  label: '在院',
  ...WARD_BED_STATUS_COLORS.occupied,
};

const CALLING_META: BedStatusMeta = {
  state: 'calling',
  label: '呼叫中',
  ...WARD_BED_STATUS_COLORS.calling,
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
