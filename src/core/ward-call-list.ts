import type { AlertTask } from './alert-workflow.ts';
import type { TwinWardEntity } from '../types/twin.ts';
import type { SwpEventSyncState } from '../types/swp-events.ts';
import { resolveDataStatus } from './data-status.ts';

export function roomCallTasks(tasks: readonly AlertTask[], ward: TwinWardEntity, roomIndex: number) {
  const timestamp = (task: AlertTask) => {
    const ms = Date.parse(task.startedAt?.replace(' ', 'T') ?? '');
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  return tasks.filter(task => task.type === 'call' && task.source === 'swp-call'
    && task.roomIndex === roomIndex && (!task.roomCode || task.roomCode === ward.sickroomCode)
    && task.locationStatus === 'matched')
    .sort((a, b) => timestamp(a) - timestamp(b) || a.id.localeCompare(b.id));
}

export function canLocateRoomCall(task: AlertTask, ward: TwinWardEntity): boolean {
  return task.canLocate !== false && !!task.bedCode?.trim()
    && ward.beds.filter(b => b.bedCode === task.bedCode).length === 1;
}

export function roomCallDataStatus(sync: SwpEventSyncState | undefined, nowMs: number) {
  const ms = Date.parse(sync?.lastSyncedAt ?? '');
  return resolveDataStatus({ phase: !sync ? 'idle' : sync.phase === 'partial' ? 'ready' : sync.phase,
    hasWarnings: sync?.phase === 'partial', lastFetchedAtMs: Number.isFinite(ms) ? ms : null, nowMs });
}
