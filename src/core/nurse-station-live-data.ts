import { resolveBedStatus } from './bed-status.ts';
import { resolveSyncStatus } from './data-status.ts';
import { buildEnvironmentSummary, type EnvironmentSummary } from './environment-state.ts';
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
  nowMs?: number,
): ShiftHandoffSummary {
  const retainedCount = tasks.filter(task => task.retained && task.type !== 'env').length;
  const retainedEnvironmentRooms = new Set(
    tasks.filter(task => task.retained && task.type === 'env').map(task => task.roomCode || task.roomName),
  ).size;
  tasks = tasks.filter(task => !task.retained);
  const callCount = tasks.filter(task => task.type === 'call').length;
  const deviceCount = tasks.filter(task => task.type === 'offline').length;
  const vitalCount = tasks.filter(task => task.type === 'vital').length;
  const environmentRoomCount = new Set(
    tasks.filter(task => task.type === 'env').map(task => task.roomCode || task.roomName),
  ).size;
  const infusionCount = tasks.filter(task => task.type === 'infusion').length;
  const clinicalItems = [
    vitalCount ? `生命体征预警 ${vitalCount} 项` : '',
    callCount ? `呼叫待办 ${callCount} 项` : '',
    deviceCount ? `设备异常 ${deviceCount} 项` : '',
    environmentRoomCount ? `环境异常病房 ${environmentRoomCount} 间` : '',
    retainedEnvironmentRooms ? `环境异常待核实 ${retainedEnvironmentRooms} 间，请核对现场读数` : '',
    infusionCount ? `输液待巡视 ${infusionCount} 床` : '',
    retainedCount ? `${retainedCount} 项记录状态待确认，请核对是否仍需处理` : '',
  ].filter(Boolean);

  const status = resolveSyncStatus(sync, nowMs);
  const syncItem = status === 'stale'
    ? '信息暂未更新，请结合管理机或话机核对'
    : sync?.phase === 'ready'
      ? '信息已更新'
      : sync?.phase === 'partial'
        ? '目前仅有部分记录，请结合管理机或话机确认'
        : sync?.phase === 'error'
          ? '信息暂未更新，请结合管理机或话机确认'
          : '信息正在更新，请稍后核对';
  const hasAttention = clinicalItems.length > 0 || status !== 'ready';

  return {
    level: hasAttention ? 'attention' : 'normal',
    title: (retainedCount || retainedEnvironmentRooms) && !tasks.length ? '交班信息需核对' : clinicalItems.length ? '当前重点事项' : status === 'ready' ? '当前无重点事项' : '交班信息需核对',
    items: clinicalItems.length
      ? [...clinicalItems, syncItem]
      : [status === 'ready' ? '当前记录中暂无待交接事项' : '信息尚不完整，请核对是否仍有待交接事项', syncItem],
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
  environment: EnvironmentSummary = buildEnvironmentSummary(area.rooms),
): NurseStationLiveData {
  const beds = area.rooms.flatMap(room => room.beds);
  const occupiedBeds = beds.filter(bed => bed.isOccupied).length;
  const callingCount = beds.filter(bed => bed.isCalling).length;
  const infusingCount = beds.filter(bed => resolveBedStatus(bed).state === 'infusing').length;
  const offlineDeviceCount = beds.filter(bed => resolveBedStatus(bed).state === 'offline').length;
  const lowBatteryDeviceCount = beds.filter(bed => resolveBedStatus(bed).state === 'lowBattery').length;
  const offlineBedCount = offlineDeviceCount + lowBatteryDeviceCount;
  const envWarningCount = environment.warningRooms;

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
      if (bed.isOnline && bedState !== 'offline')
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
      : deviceOnline < deviceTotal
        ? { level: 'attention' as const, label: '设备待复核', message: '部分设备在线状态未确认，请结合现场设备复核' }
        : environment.pendingRooms > 0
          ? { level: 'attention' as const, label: '环境数据待核实', message: `${environment.pendingRooms} 间病房环境数据待更新${environment.unverifiedWarningRooms ? `，其中 ${environment.unverifiedWarningRooms} 间原有异常待核实` : ''}` }
        : { level: 'normal' as const, label: '运行正常', message: '当前已获取数据中未发现异常' };
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
