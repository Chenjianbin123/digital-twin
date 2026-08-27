import { resolveBedStatus } from './bed-status.ts';
import type { RoomSummary } from './area-summary.ts';
import type { AlertTask } from './alert-workflow.ts';
import type { SwpEventSyncState } from '../types/swp-events.ts';
import type { TwinAreaEntity, TwinBedEntity } from '@/types/twin.ts';

export interface ShiftHandoffSummary {
  level: 'normal' | 'attention';
  title: string;
  items: string[];
}

export function buildShiftHandoffSummary(
  tasks: readonly AlertTask[],
  sync?: SwpEventSyncState,
): ShiftHandoffSummary {
  const callCount = tasks.filter(task => task.type === 'call').length;
  const deviceCount = tasks.filter(task => task.type === 'offline').length;
  const environmentRoomCount = new Set(
    tasks.filter(task => task.type === 'env').map(task => task.roomCode || task.roomName),
  ).size;
  const infusionCount = tasks.filter(task => task.type === 'infusion').length;
  const clinicalItems = [
    callCount ? `未结束呼叫 ${callCount} 项` : '',
    deviceCount ? `设备异常 ${deviceCount} 项` : '',
    environmentRoomCount ? `环境异常病房 ${environmentRoomCount} 间` : '',
    infusionCount ? `输液待巡视 ${infusionCount} 床` : '',
  ].filter(Boolean);

  const syncItem = sync?.phase === 'ready'
    ? '实时数据已同步'
    : sync?.phase === 'partial'
      ? '实时数据部分同步，请结合管理机或话机确认'
      : sync?.phase === 'error'
        ? '实时数据同步异常，请结合管理机或话机确认'
        : '实时数据正在同步，请稍后复核';
  const hasAttention = clinicalItems.length > 0 || sync?.phase !== 'ready';

  return {
    level: hasAttention ? 'attention' : 'normal',
    title: clinicalItems.length ? '本班需重点交接' : '本班暂无重点交接',
    items: clinicalItems.length
      ? [...clinicalItems, syncItem]
      : ['当前无未结束呼叫、设备异常、环境异常或输液巡视事项', syncItem],
  };
}

export interface NurseStationLiveData {
  rooms: number;
  totalBeds: number;
  occupiedBeds: number;
  emptyBeds: number;
  occupiedRate: number | null;
  callingCount: number;
  infusingCount: number;
  offlineBedCount: number;
  offlineDeviceCount: number;
  lowBatteryDeviceCount: number;
  envWarningCount: number;
  deviceTotal: number;
  deviceOnline: number;
  deviceHealthRate: number | null;
  priorityRooms: RoomSummary[];
  patientBeds: TwinBedEntity[];
  state: {
    level: 'normal' | 'attention' | 'urgent';
    label: string;
    message: string;
  };
}

const PRIORITY_ORDER: Record<RoomSummary['priority'], number> = {
  calling: 0,
  danger: 1,
  offline: 2,
  warning: 3,
  infusing: 4,
  normal: 5,
  empty: 6,
};

function hasDeviceCode(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

/** Derives all nurse-station metrics from the current real area payload. */
export function buildNurseStationLiveData(
  area: TwinAreaEntity,
  summaries: readonly RoomSummary[],
  configuredDeviceCount = 0,
): NurseStationLiveData {
  const beds = area.rooms.flatMap(room => room.beds);
  const occupiedBeds = beds.filter(bed => bed.isOccupied).length;
  const callingCount = beds.filter(bed => bed.isCalling).length;
  const infusingCount = beds.filter(bed => resolveBedStatus(bed).state === 'infusing').length;
  const offlineDeviceCount = beds.filter(bed => resolveBedStatus(bed).state === 'offline').length;
  const lowBatteryDeviceCount = beds.filter(bed => resolveBedStatus(bed).state === 'lowBattery').length;
  const offlineBedCount = offlineDeviceCount + lowBatteryDeviceCount;
  const envWarningCount = summaries.filter(summary => summary.envAlertLevel !== 'normal').length;

  const deviceCodes = new Set<string>();
  const onlineCodes = new Set<string>();
  for (const room of area.rooms) {
    if (hasDeviceCode(room.deviceCode)) {
      deviceCodes.add(room.deviceCode.trim());
      if (room.isOnline === true)
        onlineCodes.add(room.deviceCode.trim());
    }
    for (const bed of room.beds) {
      if (!hasDeviceCode(bed.deviceCode))
        continue;
      const code = bed.deviceCode.trim();
      deviceCodes.add(code);
      const bedState = resolveBedStatus(bed).state;
      if (bed.isOnline && bedState !== 'offline' && bedState !== 'lowBattery')
        onlineCodes.add(code);
    }
  }

  const deviceTotal = Math.max(deviceCodes.size, configuredDeviceCount);
  const deviceOnline = Math.min(deviceTotal, onlineCodes.size);
  const deviceAttentionMessage = [
    offlineDeviceCount ? `${offlineDeviceCount} 台设备离线` : '',
    lowBatteryDeviceCount ? `${lowBatteryDeviceCount} 台设备低电量` : '',
  ].filter(Boolean).join('，');
  const state = callingCount > 0
    ? { level: 'urgent' as const, label: '紧急响应', message: `${callingCount} 床正在呼叫，请优先处置` }
    : offlineBedCount > 0 || envWarningCount > 0
      ? {
          level: 'attention' as const,
          label: '需要关注',
          message: offlineBedCount > 0
            ? deviceAttentionMessage
            : `${envWarningCount} 间病房环境需要复核`,
        }
      : { level: 'normal' as const, label: '运行正常', message: '呼叫、设备与环境均处于正常范围' };
  const priorityRooms = [...summaries]
    .filter(summary => summary.priority !== 'normal' && summary.priority !== 'empty')
    .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] || left.roomIndex - right.roomIndex)
    .slice(0, 4);

  return {
    rooms: area.rooms.length,
    totalBeds: beds.length,
    occupiedBeds,
    emptyBeds: beds.length - occupiedBeds,
    occupiedRate: beds.length ? Math.round((occupiedBeds / beds.length) * 100) : null,
    callingCount,
    infusingCount,
    offlineBedCount,
    offlineDeviceCount,
    lowBatteryDeviceCount,
    envWarningCount,
    deviceTotal,
    deviceOnline,
    deviceHealthRate: deviceTotal ? Math.round((deviceOnline / deviceTotal) * 100) : null,
    priorityRooms,
    patientBeds: beds.filter(bed => bed.isOccupied),
    state,
  };
}
