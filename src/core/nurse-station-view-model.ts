import type { RoomPriority, RoomSummary } from './area-summary.ts';
import type { AlertTask } from './alert-workflow.ts';
import {
  buildDataFreshnessItems,
  buildDataHealthSummary,
  type DataFreshnessItem,
  type DataHealthSummary,
  type DataStatus,
} from './data-status.ts';
import {
  buildNurseStationLiveData,
  buildShiftHandoffSummary,
  type NurseStationLiveData,
  type ShiftHandoffSummary,
} from './nurse-station-live-data.ts';
import type { InspectionRoomSummary, InspectionSyncState } from '../types/inspection.ts';
import type {
  NormalizedSwpEvent,
  SwpEventSyncState,
  SwpResponseMetrics,
} from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

export interface NurseStationRoomSummary extends RoomSummary {
  vitalWarningCount: number;
}

export interface NurseStationMetrics extends NurseStationLiveData {
  occupied: number;
  empty: number;
  calling: number;
  offlineBeds: number;
  envWarnings: number;
  vitalWarnings: number;
}

export interface NurseStationRealtimeStatus {
  status: DataStatus;
  label: string;
  detail: string;
  syncedAt: string | null;
}

export interface NurseStationViewModel {
  area: TwinAreaEntity;
  roomSummaries: NurseStationRoomSummary[];
  alertTasks: AlertTask[];
  swpEvents: NormalizedSwpEvent[];
  swpResponseMetrics: SwpResponseMetrics;
  swpEventSync: SwpEventSyncState;
  swpResponseSync: SwpEventSyncState;
  inspectionRoomSummaries: InspectionRoomSummary[];
  inspectionSync: InspectionSyncState;
  metrics: NurseStationMetrics;
  state: NurseStationLiveData['state'];
  shiftHandoff: ShiftHandoffSummary;
  dataHealth: DataHealthSummary;
  dataFreshnessItems: DataFreshnessItem[];
  realtime: NurseStationRealtimeStatus;
}

export interface BuildNurseStationViewModelInput {
  areaId?: number | null;
  area: TwinAreaEntity;
  roomSummaries: readonly RoomSummary[];
  configuredDeviceCount?: number;
  alertTasks?: readonly AlertTask[];
  swpEvents?: readonly NormalizedSwpEvent[];
  swpResponseMetrics?: SwpResponseMetrics;
  swpEventSync?: SwpEventSyncState;
  swpResponseSync?: SwpEventSyncState;
  inspectionRoomSummaries?: readonly InspectionRoomSummary[];
  inspectionSync?: InspectionSyncState;
  wardDataStatus?: DataStatus;
  wardDataSyncedAtMs?: number | null;
}

const EMPTY_SYNC: SwpEventSyncState = {
  phase: 'idle',
  lastSyncedAt: null,
  error: null,
  warning: null,
};

const EMPTY_RESPONSE_METRICS: SwpResponseMetrics = {
  callCount: 0,
  arrivedCallCount: 0,
  unattendedCallCount: 0,
  arrivalCount: 0,
  averageResponseSeconds: null,
  latestCallAt: null,
};

const PRIORITY_COLORS: Record<RoomPriority, string> = {
  calling: '#E91E63',
  danger: '#FF1744',
  offline: '#FF0004',
  infusing: '#FF9800',
  warning: '#FFB74D',
  normal: '#4FC3F7',
  empty: '#9E9E9E',
};

const PRIORITY_RANK: Record<RoomPriority, number> = {
  calling: 0,
  danger: 1,
  offline: 2,
  infusing: 3,
  warning: 4,
  normal: 5,
  empty: 6,
};

function physicalCallKey(roomCode: string, bedCode: string | undefined, id: string) {
  return roomCode && bedCode ? `bed:${roomCode}:${bedCode}` : `event:${id}`;
}

function stripStatusPart(statusText: string, prefix: string) {
  return statusText
    .split(' · ')
    .filter(part => !part.startsWith(prefix))
    .filter(Boolean);
}

function buildRealtimeStatus(
  freshnessItems: readonly DataFreshnessItem[],
): NurseStationRealtimeStatus {
  const statuses = freshnessItems.map(item => item.status);
  const status: DataStatus = statuses.includes('error')
    ? 'error'
    : statuses.includes('stale')
      ? 'stale'
      : statuses.includes('warning')
        ? 'warning'
        : statuses.includes('loading')
          ? 'loading'
          : 'ready';
  const label: Record<DataStatus, string> = {
    ready: '实时数据',
    loading: '数据同步中',
    warning: '部分同步',
    stale: '数据已延迟',
    error: '数据同步异常',
  };
  const affectedSources = freshnessItems
    .filter(item => item.status !== 'ready')
    .map(item => item.label)
    .join('、');
  const detail = status === 'ready'
    ? '病区、呼叫、响应与巡视数据均已同步'
    : `${affectedSources || '数据源'}${label[status]}`;
  const syncTimestamps = freshnessItems
    .map(item => item.syncedAt)
    .filter((value): value is string => value != null)
    .sort();
  const syncedAt = syncTimestamps[syncTimestamps.length - 1] ?? null;
  return {
    status,
    label: label[status],
    detail,
    syncedAt,
  };
}

/**
 * Produces the single nurse-station snapshot consumed by the DOM dashboard and
 * the Three.js displays. Active source events are merged by physical bed so a
 * real SWP call cannot disagree with the bed snapshot or be counted twice.
 */
export function buildNurseStationViewModel(
  input: BuildNurseStationViewModelInput,
): NurseStationViewModel {
  const alertTasks = [...(input.alertTasks ?? [])];
  const currentEvents = (input.swpEvents ?? []).filter(event =>
    input.areaId == null || event.areaId === input.areaId,
  );
  const roomCodes = new Set(input.area.rooms.map(room => String(room.sickroomCode)));
  const callKeys = new Set<string>();
  const roomCallKeys = new Map<string, Set<string>>();
  const vitalKeys = new Set<string>();
  const roomVitalKeys = new Map<string, Set<string>>();

  const addRoomKey = (map: Map<string, Set<string>>, roomCode: string, key: string) => {
    if (!roomCode || !roomCodes.has(roomCode))
      return;
    const keys = map.get(roomCode) ?? new Set<string>();
    keys.add(key);
    map.set(roomCode, keys);
  };
  const addCall = (roomCode: string, bedCode: string | undefined, id: string) => {
    if (roomCode && !roomCodes.has(roomCode))
      return;
    const key = physicalCallKey(roomCode, bedCode, id);
    callKeys.add(key);
    addRoomKey(roomCallKeys, roomCode, key);
  };
  const addVital = (roomCode: string, id: string) => {
    if (roomCode && !roomCodes.has(roomCode))
      return;
    const key = `vital:${id}`;
    vitalKeys.add(key);
    addRoomKey(roomVitalKeys, roomCode, key);
  };

  for (const room of input.area.rooms) {
    const roomCode = String(room.sickroomCode);
    for (const bed of room.beds) {
      if (bed.isCalling)
        addCall(roomCode, bed.bedCode, `bed:${bed.bedCode}`);
    }
  }
  for (const task of alertTasks) {
    if (task.type === 'call')
      addCall(task.roomCode, task.bedCode, task.id);
    else if (task.type === 'vital')
      addVital(task.roomCode, task.id);
  }
  for (const event of currentEvents) {
    const roomCode = event.location?.roomCode ?? '';
    if (event.taskType === 'call')
      addCall(roomCode, event.location?.bedCode, event.id);
    else if (event.taskType === 'vital')
      addVital(roomCode, event.id);
  }

  const roomSummaries = input.roomSummaries.map((summary) => {
    const roomCode = String(summary.sickroomCode);
    const callingCount = roomCallKeys.get(roomCode)?.size ?? 0;
    const vitalWarningCount = roomVitalKeys.get(roomCode)?.size ?? 0;
    const statusParts = stripStatusPart(
      stripStatusPart(summary.statusText, '呼叫').join(' · '),
      '生命体征预警',
    );
    if (vitalWarningCount)
      statusParts.unshift(`生命体征预警 ${vitalWarningCount}`);
    if (callingCount)
      statusParts.unshift(`呼叫 ${callingCount}`);
    const priority: RoomPriority = callingCount
      ? 'calling'
      : vitalWarningCount
        ? 'danger'
        : summary.priority;
    return {
      ...summary,
      callingCount,
      vitalWarningCount,
      priority,
      accentColor: priority === summary.priority ? summary.accentColor : PRIORITY_COLORS[priority],
      statusText: statusParts.join(' · ') || `${summary.occupiedBeds}/${summary.totalBeds} 在床`,
    };
  });

  const baseLive = buildNurseStationLiveData(
    input.area,
    roomSummaries,
    input.configuredDeviceCount,
  );
  const state: NurseStationLiveData['state'] = vitalKeys.size
    ? {
        level: 'urgent',
        label: '体征预警',
        message: `${vitalKeys.size} 项生命体征预警，请优先评估患者`,
      }
    : callKeys.size
      ? {
          level: 'urgent',
          label: '紧急响应',
          message: `${callKeys.size} 项患者呼叫，请优先处置`,
        }
      : baseLive.state;
  const live: NurseStationLiveData = {
    ...baseLive,
    callingCount: callKeys.size,
    priorityRooms: roomSummaries
      .filter(room => room.priority !== 'normal' && room.priority !== 'empty')
      .sort((left, right) =>
        PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
        || left.roomIndex - right.roomIndex,
      )
      .slice(0, 4),
    state,
  };
  const metrics: NurseStationMetrics = {
    ...live,
    occupied: live.occupiedBeds,
    empty: live.emptyBeds,
    calling: live.callingCount,
    offlineBeds: live.offlineBedCount,
    envWarnings: live.envWarningCount,
    vitalWarnings: vitalKeys.size,
  };
  const swpEventSync = input.swpEventSync ?? EMPTY_SYNC;
  const swpResponseSync = input.swpResponseSync ?? EMPTY_SYNC;
  const inspectionSync = input.inspectionSync ?? EMPTY_SYNC;
  const dataHealth = buildDataHealthSummary({
    wardStatus: input.wardDataStatus ?? 'loading',
    eventSync: swpEventSync,
  });
  const dataFreshnessItems = buildDataFreshnessItems({
    wardStatus: input.wardDataStatus ?? 'loading',
    wardSyncedAtMs: input.wardDataSyncedAtMs,
    eventSync: swpEventSync,
    responseSync: swpResponseSync,
    inspectionSync,
  });
  const displayedState = state.level === 'normal' && !dataHealth.canDeclareNormal
    ? {
        level: 'attention' as const,
        label: '数据需复核',
        message: '数据未完全同步，暂不能判断病区运行正常',
      }
    : state;
  const shiftHandoff = buildShiftHandoffSummary(alertTasks, swpEventSync);
  const displayedShiftHandoff: ShiftHandoffSummary = dataHealth.canDeclareNormal || alertTasks.length > 0
    ? shiftHandoff
    : {
        level: 'attention',
        title: '交班数据需复核',
        items: [
          '数据未完全同步，暂不能确认本班无待交接事项',
          '请结合管理机、话机和现场设备确认',
        ],
      };

  return {
    area: input.area,
    roomSummaries,
    alertTasks,
    swpEvents: currentEvents,
    swpResponseMetrics: input.swpResponseMetrics ?? EMPTY_RESPONSE_METRICS,
    swpEventSync,
    swpResponseSync,
    inspectionRoomSummaries: [...(input.inspectionRoomSummaries ?? [])],
    inspectionSync,
    metrics,
    state: displayedState,
    shiftHandoff: displayedShiftHandoff,
    dataHealth,
    dataFreshnessItems,
    realtime: buildRealtimeStatus(dataFreshnessItems),
  };
}
