import type { AlertAckState, AlertTask } from './alert-workflow.ts';
import { locateInspection } from './inspection-location.ts';
import { inspectionAssociationIssue } from './inspection-association-issues.ts';
import type {
  InspectionAssociation,
  InspectionRoomState,
  InspectionRoomSummary,
  InspectionState,
  NormalizedInspectionRecord,
  SwpInspectionRecord,
} from '../types/inspection.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const OVERDUE_PATTERN = /异常|超时|逾期|未巡视|漏巡/;
const DUE_PATTERN = /待巡视|即将|临近/;
const NORMAL_PATTERN = /已巡视|正常|完成/;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function parseTime(value: string): number {
  if (!value)
    return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function resolveState(value: unknown): InspectionState {
  const label = text(value);
  if (OVERDUE_PATTERN.test(label))
    return 'overdue';
  if (DUE_PATTERN.test(label))
    return 'due';
  if (NORMAL_PATTERN.test(label))
    return 'normal';
  return 'unknown';
}

function stateLabel(state: InspectionRoomState, source = ''): string {
  if (state === 'overdue')
    return '巡视超时';
  if (state === 'due')
    return '待巡视';
  if (state === 'normal')
    return '已巡视';
  if (state === 'no-record')
    return '暂无记录';
  return source || '状态待确认';
}

function preferInspectionRecord(previous: NormalizedInspectionRecord | undefined, incoming: NormalizedInspectionRecord) {
  if (!previous) return incoming;
  if (Number.isFinite(previous.timestampMs) && Number.isFinite(incoming.timestampMs) && previous.timestampMs !== incoming.timestampMs)
    return incoming.timestampMs > previous.timestampMs ? incoming : previous;
  // Equal/missing times do not prove recovery. Preserve the state that needs attention.
  const attention: Record<InspectionState, number> = { overdue: 3, due: 2, unknown: 1, normal: 0 };
  return attention[incoming.state] > attention[previous.state] ? incoming : previous;
}

export function normalizeInspectionRecords(
  records: SwpInspectionRecord[],
  area: TwinAreaEntity,
): NormalizedInspectionRecord[] {
  return associateInspectionRecords(records, area).records;
}

export function associateInspectionRecords(
  records: SwpInspectionRecord[],
  area: TwinAreaEntity,
  areaId?: number,
): { records: NormalizedInspectionRecord[]; association: InspectionAssociation } {
  const latest = new Map<string, NormalizedInspectionRecord>();
  const association: InspectionAssociation = { received: records.length, matched: 0, unmatched: 0, issues: [] };
  const issueGroups = new Map<string, InspectionAssociation['issues'][number]>();

  records.forEach((record, index) => {
    const location = locateInspection(record, area, areaId);
    if ('reason' in location) {
      association.unmatched += 1;
      const issue = inspectionAssociationIssue(record, area, location.reason!);
      const key = JSON.stringify([issue.roomName, issue.bedName, issue.reason]);
      const existing = issueGroups.get(key);
      if (existing) existing.count = (existing.count ?? 1) + 1;
      else issueGroups.set(key, issue);
      return;
    }
    association.matched += 1;
    const occurredAt = text(record.swipeTime || record.swipeDate || record.createTime);
    const timestampMs = parseTime(occurredAt);
    const sourceState = text(record.swipeState);
    const bedCode = location.bed?.bedCode;
    const key = `${location.room.sickroomCode}:${bedCode || 'room'}`;
    const normalized: NormalizedInspectionRecord = {
      id: text(record.id) || `${key}:${occurredAt || index}`,
      roomIndex: location.roomIndex,
      roomCode: location.room.sickroomCode,
      roomName: location.room.sickroomName,
      ...(bedCode ? { bedCode } : {}),
      ...(location.bed?.bedName || record.bedName
        ? { bedName: location.bed?.bedName || text(record.bedName) }
        : {}),
      ...(record.sickName || location.bed?.sickInfo?.sickName
        ? { patientName: text(record.sickName || location.bed?.sickInfo?.sickName) }
        : {}),
      ...(record.sickNursingLevel || record.nursingLevel
        ? { nursingLevel: text(record.sickNursingLevel || record.nursingLevel) }
        : {}),
      ...(record.doorUserRealname ? { nurseName: text(record.doorUserRealname) } : {}),
      state: resolveState(sourceState),
      stateLabel: stateLabel(resolveState(sourceState), sourceState),
      occurredAt,
      timestampMs,
      ...(record.intervalSwipeDuration != null || record.swipeInterval != null
        ? {
            intervalLabel: text(
              record.intervalSwipeDuration ?? record.swipeInterval,
            ),
          }
        : {}),
      ...(record.lastSwipeTime ? { previousOccurredAt: text(record.lastSwipeTime) } : {}),
      ...(record.lastDoorUserRealname || record.lastSwipeUser
        ? {
            previousNurseName: text(
              record.lastDoorUserRealname || record.lastSwipeUser,
            ),
          }
        : {}),
    };
    latest.set(key, preferInspectionRecord(latest.get(key), normalized));
  });

  association.issues = [...issueGroups.values()].slice(0, 20);
  association.omittedIssueCount = association.unmatched - association.issues.reduce((sum, issue) => sum + (issue.count ?? 1), 0);
  return { records: [...latest.values()].sort((a, b) => b.timestampMs - a.timestampMs), association };
}

function resolveRoomState(records: NormalizedInspectionRecord[]): InspectionRoomState {
  if (!records.length)
    return 'no-record';
  if (records.some(item => item.state === 'overdue'))
    return 'overdue';
  if (records.some(item => item.state === 'due'))
    return 'due';
  if (records.some(item => item.state === 'normal'))
    return 'normal';
  return 'unknown';
}

export function mergeInspectionRecords(previous: NormalizedInspectionRecord[], incoming: NormalizedInspectionRecord[]): NormalizedInspectionRecord[] {
  const latest = new Map<string, NormalizedInspectionRecord>();
  for (const record of [...previous, ...incoming]) {
    const key = JSON.stringify([record.roomCode, record.bedCode ?? null]);
    latest.set(key, preferInspectionRecord(latest.get(key), record));
  }
  return [...latest.values()].sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 2000);
}

export function summarizeInspectionRooms(
  records: NormalizedInspectionRecord[],
  area: TwinAreaEntity,
): InspectionRoomSummary[] {
  return area.rooms.map((room, roomIndex) => {
    const roomRecords = records
      .filter(record => record.roomCode === room.sickroomCode)
      .sort((a, b) => b.timestampMs - a.timestampMs);
    const state = resolveRoomState(roomRecords);
    const latestRecord = roomRecords[0];
    return {
      roomIndex,
      roomCode: room.sickroomCode,
      roomName: room.sickroomName,
      state,
      stateLabel: stateLabel(state),
      latestAt: latestRecord?.occurredAt || null,
      latestNurseName: latestRecord?.nurseName || null,
      overdueCount: roomRecords.filter(item => item.state === 'overdue').length,
      dueCount: roomRecords.filter(item => item.state === 'due').length,
      normalCount: roomRecords.filter(item => item.state === 'normal').length,
      records: roomRecords,
    };
  });
}

function scopedTaskId(id: string, areaId?: string | number): string {
  return areaId == null ? id : `area:${areaId}:${id}`;
}

export function collectInspectionAlertTasks(
  summaries: InspectionRoomSummary[],
  areaId?: string | number,
  ackState: AlertAckState = {},
): AlertTask[] {
  return summaries.flatMap(summary =>
    summary.records
      .filter(record => record.state === 'overdue')
      .map(record => {
        const id = scopedTaskId(
          `inspection:${summary.roomCode}:${record.bedCode || 'room'}`,
          areaId,
        );
        const ack = ackState[id];
        const acknowledged = typeof ack === 'string'
          ? ack === 'handling'
          : ack?.status === 'handling'
            && (!ack.eventStartedAt || !record.occurredAt || ack.eventStartedAt === record.occurredAt);
        return {
          id,
          type: 'inspection' as const,
          severity: 'high' as const,
          status: acknowledged ? 'handling' as const : 'pending' as const,
          roomIndex: summary.roomIndex,
          roomName: summary.roomName,
          roomCode: summary.roomCode,
          ...(record.bedCode ? { bedCode: record.bedCode } : {}),
          ...(record.bedName ? { bedName: record.bedName } : {}),
          ...(record.patientName ? { patientName: record.patientName } : {}),
          title: '巡视超时',
          description: [
            `${summary.roomName}${record.bedName
              ? ` ${record.bedName.endsWith('床') ? record.bedName : `${record.bedName}床`}`
              : ''}`,
            record.nurseName ? `最近巡视：${record.nurseName}` : '',
            record.intervalLabel ? `间隔${record.intervalLabel}` : '',
          ].filter(Boolean).join(' · '),
          actionText: record.bedCode ? '定位床位' : '定位病房',
          canLocate: true,
          source: 'swp-inspection' as const,
          startedAt: record.occurredAt || undefined,
        };
      }),
  );
}
