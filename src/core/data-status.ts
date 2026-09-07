import type { SwpEventSyncState } from '../types/swp-events.ts';

export type DataStatus = 'loading' | 'ready' | 'warning' | 'stale' | 'error';

export type DataPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface DataHealthItem {
  key: 'beds' | 'devices' | 'environment' | 'infusion' | 'events';
  label: string;
  status: DataStatus;
  detail: string;
}

export interface DataHealthSummary {
  level: DataStatus;
  label: string;
  canDeclareNormal: boolean;
  items: DataHealthItem[];
}

export interface DataFreshnessItem {
  key: 'ward' | 'events' | 'response' | 'inspection';
  label: string;
  status: DataStatus;
  syncedAt: string | null;
}

function wardStatusDetail(status: DataStatus): string {
  if (status === 'ready')
    return '病区数据已同步';
  if (status === 'warning')
    return '病区数据部分同步';
  if (status === 'stale')
    return '病区数据已延迟';
  if (status === 'error')
    return '病区数据同步中断';
  return '病区数据同步中';
}

function eventHealth(sync: SwpEventSyncState): Pick<DataHealthItem, 'status' | 'detail'> {
  if (sync.phase === 'ready')
    return { status: 'ready', detail: '实时事件已同步' };
  if (sync.phase === 'partial')
    return { status: 'warning', detail: '部分数据可能延迟' };
  if (sync.phase === 'error') {
    return {
      status: 'error',
      detail: sync.lastSyncedAt
        ? '同步中断，当前显示最近一次数据'
        : '同步中断，暂未获取数据',
    };
  }
  return { status: 'loading', detail: '实时事件同步中' };
}

function normalizeSyncedAt(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === '')
    return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? String(value) : timestamp.toISOString();
}

function syncStatus(sync?: SwpEventSyncState): DataStatus {
  if (!sync || sync.phase === 'idle' || sync.phase === 'loading')
    return 'loading';
  if (sync.phase === 'partial')
    return 'warning';
  if (sync.phase === 'error')
    return 'error';
  return 'ready';
}

export function buildDataFreshnessItems(input: {
  wardStatus: DataStatus;
  wardSyncedAtMs?: number | null;
  eventSync?: SwpEventSyncState;
  responseSync?: SwpEventSyncState;
  inspectionSync?: SwpEventSyncState;
}): DataFreshnessItem[] {
  return [
    {
      key: 'ward',
      label: '病区数据',
      status: input.wardStatus,
      syncedAt: normalizeSyncedAt(input.wardSyncedAtMs),
    },
    {
      key: 'events',
      label: '呼叫报警',
      status: syncStatus(input.eventSync),
      syncedAt: normalizeSyncedAt(input.eventSync?.lastSyncedAt),
    },
    {
      key: 'response',
      label: '响应指标',
      status: syncStatus(input.responseSync),
      syncedAt: normalizeSyncedAt(input.responseSync?.lastSyncedAt),
    },
    {
      key: 'inspection',
      label: '巡视记录',
      status: syncStatus(input.inspectionSync),
      syncedAt: normalizeSyncedAt(input.inspectionSync?.lastSyncedAt),
    },
  ];
}

export function buildDataHealthSummary(input: {
  wardStatus: DataStatus;
  eventSync: SwpEventSyncState;
}): DataHealthSummary {
  const wardDetail = wardStatusDetail(input.wardStatus);
  const sharedDetail = input.wardStatus === 'warning' ? '随病区数据同步' : wardDetail;
  const event = eventHealth(input.eventSync);
  const items: DataHealthItem[] = [
    { key: 'beds', label: '床位与患者', status: input.wardStatus, detail: wardDetail },
    { key: 'devices', label: '设备状态', status: input.wardStatus, detail: sharedDetail },
    { key: 'environment', label: '病房环境', status: input.wardStatus, detail: sharedDetail },
    { key: 'infusion', label: '输液状态', status: input.wardStatus, detail: sharedDetail },
    { key: 'events', label: '呼叫与报警', status: event.status, detail: event.detail },
  ];
  const statuses = items.map(item => item.status);
  const level: DataStatus = statuses.includes('error')
    ? 'error'
    : statuses.includes('stale')
      ? 'stale'
      : statuses.includes('warning')
        ? 'warning'
        : statuses.includes('loading')
          ? 'loading'
          : 'ready';
  const label = level === 'ready'
    ? '数据同步正常'
    : level === 'loading'
      ? '数据正在同步'
      : level === 'error'
        ? '数据同步异常'
        : '数据同步需关注';

  return {
    level,
    label,
    canDeclareNormal: input.wardStatus === 'ready' && event.status === 'ready',
    items,
  };
}

export function resolveDataStatus(input: {
  phase: DataPhase;
  hasWarnings: boolean;
  lastFetchedAtMs: number | null;
  nowMs: number;
  staleAfterMs?: number;
}): DataStatus {
  if (input.phase === 'loading' || input.phase === 'idle')
    return 'loading';
  if (input.phase === 'error')
    return 'error';
  if (input.hasWarnings)
    return 'warning';
  const staleAfterMs = input.staleAfterMs ?? 5 * 60 * 1000;
  if (input.lastFetchedAtMs == null || input.nowMs - input.lastFetchedAtMs >= staleAfterMs)
    return 'stale';
  return 'ready';
}
