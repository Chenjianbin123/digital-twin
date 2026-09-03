import { resolveBedStatus } from './bed-status.ts';
import { analyzeEnvAlert } from './env-alert.ts';
import type {
  NormalizedSwpEvent,
  SwpEventLocationSource,
  SwpEventLocationStatus,
  SwpEventSource,
} from '../types/swp-events.ts';
import type { TwinAreaEntity, TwinSceneType } from '../types/twin.ts';

export type AlertTaskType = 'call' | 'env' | 'offline' | 'infusion' | 'inspection';
export type AlertTaskSource = SwpEventSource | 'swp-inspection';
export type AlertTaskSeverity = 'critical' | 'high' | 'medium';
export type AlertTaskStatus = 'pending' | 'handling' | 'resolved';
export type AlertWaitingLevel = 'normal' | 'attention' | 'urgent';

export const ALERT_WAITING_THRESHOLDS = {
  attentionMs: 5 * 60_000,
  urgentMs: 10 * 60_000,
} as const;

export const ALERT_FOCUS_DURATION_MS = 8_000;

export interface AlertFocusState {
  taskId: string;
  roomIndex: number;
  bedCode: string;
  expiresAtMs: number;
}

export interface AlertTask {
  id: string;
  type: AlertTaskType;
  severity: AlertTaskSeverity;
  status: Exclude<AlertTaskStatus, 'resolved'>;
  roomIndex: number;
  roomName: string;
  roomCode: string;
  bedCode?: string;
  bedName?: string;
  patientName?: string;
  title: string;
  description: string;
  actionText: string;
  canLocate?: boolean;
  source?: AlertTaskSource;
  startedAt?: string;
  locationStatus?: SwpEventLocationStatus;
  locationSource?: SwpEventLocationSource;
  resolveText?: string;
}

export interface AlertAckStateEntry {
  status: AlertTaskStatus;
  eventStartedAt?: string;
}

export type AlertAckState = Record<string, AlertTaskStatus | AlertAckStateEntry>;

export interface AlertTarget {
  sceneType: TwinSceneType;
  roomIndex: number;
  bedCode?: string;
}

const SEVERITY_RANK: Record<AlertTaskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function taskTimestamp(task: AlertTask): number {
  if (!task.startedAt)
    return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(task.startedAt.replace(' ', 'T'));
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function compareAlertTasks(a: AlertTask, b: AlertTask): number {
  const severityDifference = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severityDifference)
    return severityDifference;
  const statusDifference = (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);
  if (statusDifference)
    return statusDifference;
  const waitingDifference = taskTimestamp(a) - taskTimestamp(b);
  if (waitingDifference)
    return waitingDifference;
  return a.id.localeCompare(b.id);
}

function getTaskStatus(
  id: string,
  ackState: AlertAckState,
  eventStartedAt?: string,
): AlertTask['status'] | null {
  const entry = ackState[id];
  const status = typeof entry === 'string' ? entry : entry?.status;
  if (
    typeof entry !== 'string'
    && entry?.eventStartedAt
    && eventStartedAt
    && entry.eventStartedAt !== eventStartedAt
  )
    return 'pending';
  if (status === 'resolved')
    return 'pending';
  if (status === 'handling')
    return 'handling';
  return 'pending';
}

function scopedTaskId(id: string, areaScope?: string | number): string {
  return areaScope == null || String(areaScope).trim() === ''
    ? id
    : `area:${areaScope}:${id}`;
}

export function formatBedLabel(bedName?: string) {
  const label = String(bedName ?? '').trim();
  if (!label)
    return '床位';
  return label.endsWith('床') ? label : `${label}床`;
}

export function formatAlertWaitingTime(startedAt?: string, now = new Date()): string {
  if (!startedAt)
    return '';
  const startedAtMs = Date.parse(startedAt.replace(' ', 'T'));
  const elapsedMs = now.getTime() - startedAtMs;
  if (!Number.isFinite(startedAtMs) || elapsedMs < 0)
    return '';

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1)
    return '已等待不足1分钟';
  if (elapsedMinutes < 60)
    return `已等待${elapsedMinutes}分钟`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingMinutes = elapsedMinutes % 60;
  if (elapsedHours < 24)
    return `已等待${elapsedHours}小时${remainingMinutes ? `${remainingMinutes}分钟` : ''}`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  const remainingHours = elapsedHours % 24;
  return `已等待${elapsedDays}天${remainingHours ? `${remainingHours}小时` : ''}`;
}

export function getAlertWaitingLevel(
  startedAt?: string,
  now = new Date(),
): AlertWaitingLevel {
  if (!startedAt)
    return 'normal';
  const startedAtMs = Date.parse(startedAt.replace(' ', 'T'));
  const elapsedMs = now.getTime() - startedAtMs;
  if (!Number.isFinite(startedAtMs) || elapsedMs < ALERT_WAITING_THRESHOLDS.attentionMs)
    return 'normal';
  if (elapsedMs >= ALERT_WAITING_THRESHOLDS.urgentMs)
    return 'urgent';
  return 'attention';
}

export function createAlertFocus(
  taskId: string,
  roomIndex: number,
  bedCode: string,
  nowMs: number,
  durationMs = ALERT_FOCUS_DURATION_MS,
): AlertFocusState {
  return {
    taskId,
    roomIndex,
    bedCode,
    expiresAtMs: nowMs + durationMs,
  };
}

export function isAlertFocusExpired(
  focus: AlertFocusState | null | undefined,
  nowMs: number,
): boolean {
  return !focus || nowMs >= focus.expiresAtMs;
}

export function isAlertFocusForTask(
  focus: AlertFocusState | null | undefined,
  taskId: string,
): boolean {
  return !!focus && focus.taskId === taskId;
}

function createBedTask(
  type: AlertTaskType,
  severity: AlertTaskSeverity,
  roomIndex: number,
  room: TwinAreaEntity['rooms'][number],
  bed: TwinAreaEntity['rooms'][number]['beds'][number],
  ackState: AlertAckState,
  options: { title: string; description: string; actionText: string },
  areaScope?: string | number,
): AlertTask | null {
  const id = scopedTaskId(`${type}:${room.sickroomCode}:${bed.bedCode}`, areaScope);
  const status = getTaskStatus(id, ackState);
  if (!status)
    return null;

  return {
    id,
    type,
    severity,
    status,
    roomIndex,
    roomName: room.sickroomName,
    roomCode: room.sickroomCode,
    bedCode: bed.bedCode,
    bedName: bed.bedName,
    patientName: bed.sickInfo?.sickName,
    ...options,
  };
}

function environmentTaskTitle(env: ReturnType<typeof analyzeEnvAlert>): string {
  if (env.items.length !== 1)
    return env.level === 'danger' ? '病房环境异常' : '病房环境预警';
  const item = env.items[0];
  const subject = item.field === 'temp'
    ? '病房温度'
    : item.field === 'relativeHumid'
      ? '病房湿度'
      : item.field === 'airQuality'
        ? '空气质量'
        : '病房噪音';
  return `${subject}${env.level === 'danger' ? '异常' : '预警'}`;
}

function environmentTaskGuidance(env: ReturnType<typeof analyzeEnvAlert>): string {
  if (env.items.length !== 1)
    return '请复核病房环境，必要时联系后勤处理';
  const field = env.items[0].field;
  if (field === 'temp')
    return '请检查空调和通风';
  if (field === 'relativeHumid')
    return '请检查除湿和通风';
  if (field === 'airQuality')
    return '请加强通风并检查空气净化设备';
  return '请查找噪音来源，保障病房安静';
}

export function collectAlertTasks(
  area: TwinAreaEntity,
  ackState: AlertAckState = {},
  areaScope?: string | number,
): AlertTask[] {
  const tasks: AlertTask[] = [];

  area.rooms.forEach((room, roomIndex) => {
    for (const bed of room.beds) {
      if (bed.isCalling) {
        const task = createBedTask('call', 'critical', roomIndex, room, bed, ackState, {
          title: '床位呼叫',
          description: `${room.sickroomName} ${formatBedLabel(bed.bedName)}正在呼叫护士站`,
          actionText: '进入床位',
        }, areaScope);
        if (task)
          tasks.push(task);
      }
    }

    const env = analyzeEnvAlert(room.doorEnvData);
    if (env.level !== 'normal') {
      const id = scopedTaskId(`env:${room.sickroomCode}:room`, areaScope);
      const status = getTaskStatus(id, ackState);
      if (status) {
        tasks.push({
          id,
          type: 'env',
          severity: env.level === 'danger' ? 'critical' : 'medium',
          status,
          roomIndex,
          roomName: room.sickroomName,
          roomCode: room.sickroomCode,
          title: environmentTaskTitle(env),
          description: `${env.summary}，${environmentTaskGuidance(env)}`,
          actionText: '定位病房',
        });
      }
    }

    for (const bed of room.beds) {
      const bedStatus = resolveBedStatus(bed);
      if (bedStatus.state === 'offline' || bedStatus.state === 'lowBattery') {
        const deviceGuidance = bedStatus.state === 'lowBattery'
          ? '请及时充电或更换电池'
          : bed.statusBarInfo?.status === '307'
            ? '请检查设备连接和运行状态'
            : '请检查设备电源和网络';
        const task = createBedTask('offline', 'high', roomIndex, room, bed, ackState, {
          title: bedStatus.label,
          description: `${room.sickroomName} ${formatBedLabel(bed.bedName)}，${deviceGuidance}`,
          actionText: '查看设备',
        }, areaScope);
        if (task)
          tasks.push(task);
      }
      else if (bedStatus.state === 'infusing') {
        const task = createBedTask('infusion', 'medium', roomIndex, room, bed, ackState, {
          title: '输液巡视',
          description: `${room.sickroomName} ${formatBedLabel(bed.bedName)}正在输液，请按巡视计划确认滴速和通路`,
          actionText: '查看床位',
        }, areaScope);
        if (task)
          tasks.push(task);
      }
    }
  });

  return tasks.sort(compareAlertTasks);
}

export function collectSwpAlertTasks(
  events: NormalizedSwpEvent[],
  ackState: AlertAckState = {},
  areaScope?: string | number,
): AlertTask[] {
  const tasks: AlertTask[] = [];
  for (const event of events) {
    const location = event.location;
    const isDisplayOnlyCall = event.source === 'swp-call' && event.taskType === 'call';
    const equivalentLocalId = event.taskType === 'call' && location?.bedCode
      ? scopedTaskId(`call:${location.roomCode}:${location.bedCode}`, areaScope)
      : '';
    const explicitStatus = getTaskStatus(event.id, ackState, event.startedAt);
    const status = isDisplayOnlyCall
      ? 'pending'
      : ackState[event.id]
        ? explicitStatus
        : equivalentLocalId && getTaskStatus(equivalentLocalId, ackState, event.startedAt) === 'handling'
          ? 'handling'
          : 'pending';
    if (!status)
      continue;
    tasks.push({
      id: event.id,
      type: event.taskType,
      severity: event.severity,
      status,
      roomIndex: location?.roomIndex ?? -1,
      roomName: location?.roomName ?? (isDisplayOnlyCall ? '' : event.locationLabel),
      roomCode: location?.roomCode ?? '',
      bedCode: location?.bedCode,
      bedName: location?.bedName,
      patientName: location?.patientName,
      title: event.title,
      description: event.description,
      actionText: location?.bedCode ? '定位床位' : '定位病房',
      canLocate: !!location,
      source: event.source,
      startedAt: event.startedAt,
      locationStatus: event.locationStatus,
      ...(event.locationSource ? { locationSource: event.locationSource } : {}),
    });
  }
  return tasks.sort(compareAlertTasks);
}

export function collectLocallyHiddenSwpAlertTasks(
  _events: NormalizedSwpEvent[],
  _ackState: AlertAckState = {},
  _areaScope?: string | number,
): AlertTask[] {
  return [];
}

export function suppressLocalBedCallsShadowedBySwp(
  tasks: AlertTask[],
  events: NormalizedSwpEvent[],
): AlertTask[] {
  const swpBedCalls = new Set(
    events
      .filter(event => event.taskType === 'call' && event.location?.bedCode)
      .map(event => `${event.location!.roomCode}:${event.location!.bedCode}`),
  );
  return tasks.filter(task =>
    task.type !== 'call'
    || !task.bedCode
    || !swpBedCalls.has(`${task.roomCode}:${task.bedCode}`),
  );
}

export function mergeAlertTasks(...sources: AlertTask[][]): AlertTask[] {
  const unique = new Map<string, AlertTask>();
  const physicalCalls = new Set<string>();
  for (const tasks of sources) {
    for (const task of tasks) {
      if (unique.has(task.id))
        continue;
      const physicalCallKey = task.type === 'call' && task.roomCode && task.bedCode
        ? `${task.roomCode}:${task.bedCode}`
        : '';
      if (physicalCallKey && physicalCalls.has(physicalCallKey))
        continue;
      unique.set(task.id, task);
      if (physicalCallKey)
        physicalCalls.add(physicalCallKey);
    }
  }
  return [...unique.values()].sort(compareAlertTasks);
}

export function resolveAlertTargetInArea(task: AlertTask, area: TwinAreaEntity): AlertTarget {
  if (task.canLocate === false || !task.roomCode)
    return { sceneType: 'nurse-station', roomIndex: -1 };
  const roomIndex = area.rooms.findIndex(room => String(room.sickroomCode) === task.roomCode);
  const room = area.rooms[roomIndex];
  if (!room)
    return { sceneType: 'nurse-station', roomIndex: -1 };
  if (task.bedCode) {
    if (!room.beds.some(bed => bed.bedCode === task.bedCode))
      return { sceneType: 'nurse-station', roomIndex: -1 };
    return { sceneType: 'ward-interior', roomIndex, bedCode: task.bedCode };
  }
  return { sceneType: 'ward', roomIndex };
}

export function createAlertAckState(
  current: AlertAckState,
  taskId: string,
  status: AlertTaskStatus,
  eventStartedAt?: string,
): AlertAckState {
  return {
    ...current,
    [taskId]: eventStartedAt ? { status, eventStartedAt } : status,
  };
}

export function resolveNextAlertTarget(task: AlertTask): AlertTarget {
  if (task.roomIndex < 0 || task.canLocate === false) {
    return {
      sceneType: 'nurse-station',
      roomIndex: -1,
    };
  }
  if (task.bedCode) {
    return {
      sceneType: 'ward-interior',
      roomIndex: task.roomIndex,
      bedCode: task.bedCode,
    };
  }

  return {
    sceneType: 'ward',
    roomIndex: task.roomIndex,
  };
}

export function findAlertTaskForTarget(
  tasks: AlertTask[],
  target: AlertTarget,
  area?: TwinAreaEntity,
): AlertTask | null {
  if (target.sceneType === 'nurse-station' || target.roomIndex < 0)
    return null;

  const currentRoomCode = area?.rooms[target.roomIndex]?.sickroomCode;
  const roomTasks = tasks.filter(task => currentRoomCode
    ? task.roomCode === currentRoomCode
    : task.roomIndex === target.roomIndex,
  );
  if (!roomTasks.length)
    return null;

  if (target.sceneType === 'ward') {
    return roomTasks.find(task => !task.bedCode) ?? roomTasks[0] ?? null;
  }

  if (target.bedCode) {
    const bedTask = roomTasks.find(task => task.bedCode === target.bedCode);
    return bedTask ?? null;
  }

  return roomTasks.find(task => !task.bedCode) ?? roomTasks[0] ?? null;
}
