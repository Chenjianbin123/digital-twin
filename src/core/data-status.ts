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
    return '病区信息已更新';
  if (status === 'warning')
    return '病区信息不完整';
  if (status === 'stale')
    return '病区信息更新延迟';
  if (status === 'error')
    return '病区信息暂未更新';
  return '病区信息更新中';
}

function eventHealth(sync: SwpEventSyncState, nowMs: number): Pick<DataHealthItem, 'status' | 'detail'> {
  const status = resolveSyncStatus(sync, nowMs);
  if (status === 'stale')
    return { status, detail: hasSyncedData(sync) ? '信息暂未更新，当前显示上次记录，请核对现场情况' : '更新时间未提供，当前情况需核对' };
  if (status === 'ready')
    return { status: 'ready', detail: '事件信息已更新' };
  if (sync.phase === 'partial')
    return { status: 'warning', detail: '部分记录尚未更新' };
  if (sync.phase === 'error') {
    return {
      status: 'error',
      detail: sync.lastSyncedAt
        ? '信息暂未更新，当前显示上次记录'
        : '暂未获取信息，请稍后重试',
    };
  }
  return { status: 'loading', detail: '事件信息更新中' };
}

function normalizeSyncedAt(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === '')
    return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function hasSyncedData(sync?: SwpEventSyncState): boolean {
  return normalizeSyncedAt(sync?.lastSyncedAt) !== null;
}

// A transport freshness threshold, not a clinical response deadline.
export function resolveSyncStatus(sync?: SwpEventSyncState, nowMs = Date.now()): DataStatus {
  if (!sync || sync.phase === 'idle' || sync.phase === 'loading')
    return 'loading';
  if (sync.phase === 'partial')
    return 'warning';
  if (sync.phase === 'error')
    return 'error';
  const lastSyncedAt = normalizeSyncedAt(sync.lastSyncedAt);
  if (!lastSyncedAt || Date.parse(lastSyncedAt) > nowMs || nowMs - Date.parse(lastSyncedAt) >= 5 * 60 * 1000)
    return 'stale';
  return 'ready';
}

export function buildDataFreshnessItems(input: {
  wardStatus: DataStatus;
  wardSyncedAtMs?: number | null;
  eventSync?: SwpEventSyncState;
  responseSync?: SwpEventSyncState;
  inspectionSync?: SwpEventSyncState;
  nowMs?: number;
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
      status: resolveSyncStatus(input.eventSync, input.nowMs),
      syncedAt: normalizeSyncedAt(input.eventSync?.lastSyncedAt),
    },
    {
      key: 'response',
      label: '响应指标',
      status: resolveSyncStatus(input.responseSync, input.nowMs),
      syncedAt: normalizeSyncedAt(input.responseSync?.lastSyncedAt),
    },
    {
      key: 'inspection',
      label: '巡视记录',
      status: resolveSyncStatus(input.inspectionSync, input.nowMs),
      syncedAt: normalizeSyncedAt(input.inspectionSync?.lastSyncedAt),
    },
  ];
}

export function buildDataHealthSummary(input: {
  wardStatus: DataStatus;
  eventSync: SwpEventSyncState;
  nowMs?: number;
}): DataHealthSummary {
  const wardDetail = wardStatusDetail(input.wardStatus);
  const sharedDetail = input.wardStatus === 'warning' ? '部分信息待更新' : wardDetail;
  const event = eventHealth(input.eventSync, input.nowMs ?? Date.now());
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
    ? '信息已更新'
    : level === 'loading'
      ? '信息更新中'
      : level === 'error'
        ? '信息暂未更新'
        : '信息需核对';

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
