import type { AlertTask } from './alert-workflow.ts';
import type {
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

function findLocation(record: SwpInspectionRecord, area: TwinAreaEntity) {
  const sickroomId = text(record.sickroomId);
  const sickroomCode = text(record.sickroomCode);
  const bedCode = text(record.bedCode);
  let roomIndex = area.rooms.findIndex(room =>
    (sickroomId && text(room.sickroomId) === sickroomId)
    || (sickroomCode && text(room.sickroomCode) === sickroomCode),
  );

  if (roomIndex < 0 && bedCode) {
    const matches = area.rooms
      .map((room, index) => ({
        index,
        matched: room.beds.some(bed => text(bed.bedCode) === bedCode),
      }))
      .filter(item => item.matched);
    if (matches.length === 1)
      roomIndex = matches[0].index;
  }

  const room = area.rooms[roomIndex];
  if (!room)
    return null;
  const bed = bedCode
    ? room.beds.find(item => text(item.bedCode) === bedCode)
    : undefined;
  if (bedCode && !bed)
    return null;
  return { roomIndex, room, bed };
}

export function normalizeInspectionRecords(
  records: SwpInspectionRecord[],
  area: TwinAreaEntity,
): NormalizedInspectionRecord[] {
  const latest = new Map<string, NormalizedInspectionRecord>();

  records.forEach((record, index) => {
    const location = findLocation(record, area);
    if (!location)
      return;
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
    const current = latest.get(key);
    if (!current || normalized.timestampMs > current.timestampMs)
      latest.set(key, normalized);
  });

  return [...latest.values()].sort((a, b) => b.timestampMs - a.timestampMs);
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
): AlertTask[] {
  return summaries.flatMap(summary =>
    summary.records
      .filter(record => record.state === 'overdue')
      .map(record => ({
        id: scopedTaskId(
          `inspection:${summary.roomCode}:${record.bedCode || 'room'}`,
          areaId,
        ),
        type: 'inspection' as const,
        severity: 'high' as const,
        status: 'pending' as const,
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
      })),
  );
}
