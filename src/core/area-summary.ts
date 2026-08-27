import { resolveBedStatus } from './bed-status.ts';
import { analyzeEnvAlert, type EnvAlertLevel } from './env-alert.ts';
import type { TwinWardEntity } from '../types/twin.ts';

export type RoomPriority = 'calling' | 'danger' | 'offline' | 'infusing' | 'warning' | 'normal' | 'empty';

export interface RoomSummary {
  roomIndex: number;
  sickroomName: string;
  sickroomCode: string;
  totalBeds: number;
  occupiedBeds: number;
  infusingCount: number;
  offlineCount: number;
  lowBatteryCount?: number;
  callingCount: number;
  envAlertLevel: EnvAlertLevel;
  priority: RoomPriority;
  accentColor: string;
  statusText: string;
}

const PRIORITY_COLORS: Record<RoomPriority, string> = {
  calling: '#E91E63',
  danger: '#FF1744',
  offline: '#FF0004',
  infusing: '#FF9800',
  warning: '#FFB74D',
  normal: '#4FC3F7',
  empty: '#9E9E9E',
};

function resolvePriority(
  callingCount: number,
  offlineCount: number,
  infusingCount: number,
  envLevel: EnvAlertLevel,
  occupiedBeds: number,
): RoomPriority {
  if (callingCount > 0)
    return 'calling';
  if (envLevel === 'danger')
    return 'danger';
  if (offlineCount > 0)
    return 'offline';
  if (infusingCount > 0)
    return 'infusing';
  if (envLevel === 'warning')
    return 'warning';
  if (occupiedBeds > 0)
    return 'normal';
  return 'empty';
}

function buildStatusText(summary: Omit<RoomSummary, 'statusText'>): string {
  const parts: string[] = [];
  if (summary.callingCount)
    parts.push(`呼叫 ${summary.callingCount}`);
  if (summary.infusingCount)
    parts.push(`输液 ${summary.infusingCount}`);
  const lowBatteryCount = summary.lowBatteryCount ?? 0;
  const disconnectedCount = Math.max(0, summary.offlineCount - lowBatteryCount);
  if (disconnectedCount)
    parts.push(`离线 ${disconnectedCount}`);
  if (lowBatteryCount)
    parts.push(`低电量 ${lowBatteryCount}`);
  if (summary.envAlertLevel !== 'normal')
    parts.push(summary.envAlertLevel === 'danger' ? '环境异常' : '环境预警');
  if (!parts.length)
    parts.push(`${summary.occupiedBeds}/${summary.totalBeds} 在床`);
  return parts.join(' · ');
}

export function summarizeRoom(room: TwinWardEntity, roomIndex: number): RoomSummary {
  let infusingCount = 0;
  let offlineCount = 0;
  let lowBatteryCount = 0;
  let callingCount = 0;
  let occupiedBeds = 0;

  for (const bed of room.beds) {
    const status = resolveBedStatus(bed);
    if (bed.isOccupied)
      occupiedBeds++;
    if (status.state === 'infusing')
      infusingCount++;
    if (status.state === 'offline' || status.state === 'lowBattery')
      offlineCount++;
    if (status.state === 'lowBattery')
      lowBatteryCount++;
    if (bed.isCalling)
      callingCount++;
  }

  const envAlert = analyzeEnvAlert(room.doorEnvData);
  const priority = resolvePriority(callingCount, offlineCount, infusingCount, envAlert.level, occupiedBeds);

  const base: Omit<RoomSummary, 'statusText'> = {
    roomIndex,
    sickroomName: room.sickroomName,
    sickroomCode: room.sickroomCode,
    totalBeds: room.beds.length,
    occupiedBeds,
    infusingCount,
    offlineCount,
    lowBatteryCount,
    callingCount,
    envAlertLevel: envAlert.level,
    priority,
    accentColor: PRIORITY_COLORS[priority],
  };

  return {
    ...base,
    statusText: buildStatusText(base),
  };
}

export function summarizeArea(rooms: TwinWardEntity[]): RoomSummary[] {
  return rooms.map((room, index) => summarizeRoom(room, index));
}
