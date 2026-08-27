import type { AlertTaskStatus } from '@/core/alert-workflow';

export interface AlertAckRecord {
  taskId: string;
  status: AlertTaskStatus;
  eventStartedAt?: string;
  operator: string;
  updatedAt: string;
  syncState: 'pending' | 'synced' | 'local' | 'failed';
  syncError?: string;
}

export type AlertAckRecordMap = Record<string, AlertAckRecord>;

export const ALERT_ACK_STORAGE_KEY = 'ward-digital-twin:alert-ack-records';

export function getDefaultAlertOperator() {
  return import.meta.env.VITE_WARD_OPERATOR?.trim() || '护士站';
}

export function loadAlertAckRecords(): AlertAckRecordMap {
  try {
    const raw = window.localStorage.getItem(ALERT_ACK_STORAGE_KEY);
    if (!raw)
      return {};
    const parsed = JSON.parse(raw) as AlertAckRecordMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }
  catch {
    return {};
  }
}

export function saveAlertAckRecords(records: AlertAckRecordMap) {
  window.localStorage.setItem(ALERT_ACK_STORAGE_KEY, JSON.stringify(records));
}

export function removeAlertAckRecord(
  records: AlertAckRecordMap,
  taskId: string,
  persist = true,
): AlertAckRecordMap {
  if (!(taskId in records))
    return records;
  const next = { ...records };
  delete next[taskId];
  if (persist)
    saveAlertAckRecords(next);
  return next;
}

export function clearRecoveredAlertAckRecords(
  records: AlertAckRecordMap,
  previousTaskIds: readonly string[],
  currentTaskIds: readonly string[],
  persist = true,
): AlertAckRecordMap {
  const current = new Set(currentTaskIds);
  const recovered = new Set(previousTaskIds.filter(taskId => !current.has(taskId)));
  if (!recovered.size)
    return records;

  const next = { ...records };
  let changed = false;
  for (const taskId of recovered) {
    const record = next[taskId];
    if (!record || (record.status !== 'handling' && record.status !== 'resolved'))
      continue;
    delete next[taskId];
    changed = true;
  }
  if (!changed)
    return records;
  if (persist)
    saveAlertAckRecords(next);
  return next;
}

export function upsertAlertAckRecord(
  records: AlertAckRecordMap,
  taskId: string,
  status: AlertTaskStatus,
  operator = getDefaultAlertOperator(),
  eventStartedAt?: string,
): AlertAckRecordMap {
  const next: AlertAckRecordMap = {
    ...records,
    [taskId]: {
      taskId,
      status,
      eventStartedAt,
      operator,
      updatedAt: new Date().toISOString(),
      syncState: 'pending',
    },
  };
  saveAlertAckRecords(next);
  return next;
}

export function updateAlertAckSyncState(
  records: AlertAckRecordMap,
  taskId: string,
  syncState: AlertAckRecord['syncState'],
  syncError?: string,
): AlertAckRecordMap {
  const record = records[taskId];
  if (!record)
    return records;
  const next = {
    ...records,
    [taskId]: { ...record, syncState, syncError },
  };
  saveAlertAckRecords(next);
  return next;
}
