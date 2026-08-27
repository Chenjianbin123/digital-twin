import type {
  NormalizedSwpEvent,
  SwpAlarmRecord,
  SwpCallRecord,
  SwpEventLocation,
  SwpEventLocationSource,
  SwpEventLocationStatus,
  SwpIdentifier,
  SwpResponseMetrics,
  SwpResponseTimelinessRecord,
} from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

interface NormalizeSwpEventsOptions {
  area: TwinAreaEntity;
  areaId: number;
  calls: SwpCallRecord[];
  alarms: SwpAlarmRecord[];
}

type LocationRecord = Pick<
  SwpCallRecord,
  'sickroomId' | 'sickroomCode' | 'bedCode' | 'deviceCode'
> & Partial<Pick<SwpCallRecord, 'callFrom'>>;

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function isActiveEvent(status: SwpIdentifier | undefined): boolean {
  const value = text(status);
  return !value || value === '0';
}

function belongsToArea(recordAreaId: SwpIdentifier | undefined, areaId: number): boolean {
  const value = text(recordAreaId);
  return !value || value === String(areaId);
}

function parseTimestamp(value?: string): number {
  if (!value)
    return 0;
  const timestamp = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function findLocation(area: TwinAreaEntity, record: LocationRecord): SwpEventLocation | null {
  const sickroomId = text(record.sickroomId);
  const sickroomCode = text(record.sickroomCode);
  const bedCode = text(record.bedCode);
  const deviceCode = text(record.deviceCode);

  const roomMatches: number[] = [];
  const bedMatches: Array<{ roomIndex: number; bedIndex: number }> = [];
  let ambiguous = false;

  function addRoomIdentifier(value: string, pick: (room: TwinAreaEntity['rooms'][number]) => unknown) {
    if (!value)
      return;
    const matches = area.rooms
      .map((room, roomIndex) => text(pick(room)) === value ? roomIndex : -1)
      .filter(roomIndex => roomIndex >= 0);
    if (matches.length > 1)
      ambiguous = true;
    else if (matches.length === 1)
      roomMatches.push(matches[0]);
  }

  function addBedIdentifier(value: string, pick: (bed: TwinAreaEntity['rooms'][number]['beds'][number]) => unknown) {
    if (!value)
      return;
    const matches: Array<{ roomIndex: number; bedIndex: number }> = [];
    area.rooms.forEach((room, roomIndex) => {
      room.beds.forEach((bed, bedIndex) => {
        if (text(pick(bed)) === value)
          matches.push({ roomIndex, bedIndex });
      });
    });
    if (matches.length > 1)
      ambiguous = true;
    else if (matches.length === 1)
      bedMatches.push(matches[0]);
  }

  addRoomIdentifier(sickroomId, room => room.sickroomId);
  addRoomIdentifier(sickroomCode, room => room.sickroomCode);
  addRoomIdentifier(deviceCode, room => room.deviceCode);
  addBedIdentifier(bedCode, bed => bed.bedCode);
  addBedIdentifier(deviceCode, bed => bed.deviceCode);

  if (!sickroomId && !sickroomCode && !bedCode && !deviceCode) {
    const exactCallSource = text(record.callFrom);
    addRoomIdentifier(exactCallSource, room => room.sickroomCode);
    addRoomIdentifier(exactCallSource, room => room.deviceCode);
    addBedIdentifier(exactCallSource, bed => bed.bedCode);
    addBedIdentifier(exactCallSource, bed => bed.deviceCode);
  }

  const matchedRoomIndexes = new Set([
    ...roomMatches,
    ...bedMatches.map(match => match.roomIndex),
  ]);
  const matchedBeds = new Map(
    bedMatches.map(match => [`${match.roomIndex}:${match.bedIndex}`, match]),
  );
  if (ambiguous || matchedRoomIndexes.size !== 1 || matchedBeds.size > 1)
    return null;

  const roomIndex = [...matchedRoomIndexes][0];
  const bedMatch = [...matchedBeds.values()][0];
  const room = area.rooms[roomIndex];
  if (!room)
    return null;
  const bed = bedMatch ? room.beds[bedMatch.bedIndex] : undefined;
  return {
    roomIndex,
    roomCode: room.sickroomCode,
    roomName: room.sickroomName,
    bedCode: bed?.bedCode,
    bedName: bed?.bedName,
    patientName: bed?.sickInfo?.sickName,
  };
}

function resolveLocationSource(
  area: TwinAreaEntity,
  record: LocationRecord,
  location: SwpEventLocation | null,
): SwpEventLocationSource | undefined {
  if (!location)
    return undefined;
  const room = area.rooms[location.roomIndex];
  const bed = location.bedCode
    ? room?.beds.find(candidate => candidate.bedCode === location.bedCode)
    : undefined;
  const sickroomId = text(record.sickroomId);
  const sickroomCode = text(record.sickroomCode);
  const bedCode = text(record.bedCode);
  const deviceCode = text(record.deviceCode);
  if (sickroomId && sickroomId === text(room?.sickroomId))
    return 'sickroom-id';
  if (bedCode && bedCode === text(bed?.bedCode))
    return 'bed-code';
  if (
    deviceCode
    && (deviceCode === text(room?.deviceCode) || deviceCode === text(bed?.deviceCode))
  )
    return 'device-code';
  if (sickroomCode && sickroomCode === text(room?.sickroomCode))
    return 'sickroom-code';

  if (!sickroomId && !sickroomCode && !bedCode && !deviceCode) {
    const callFrom = text(record.callFrom);
    if (
      callFrom
      && (
        callFrom === text(room?.sickroomCode)
        || callFrom === text(room?.deviceCode)
        || callFrom === text(bed?.bedCode)
        || callFrom === text(bed?.deviceCode)
      )
    )
      return 'call-from-code';
  }
  return undefined;
}

function resolveLocationStatus(
  record: LocationRecord,
  location: SwpEventLocation | null,
): SwpEventLocationStatus {
  if (location)
    return 'matched';
  const hasIdentifiers = [record.sickroomId, record.sickroomCode, record.bedCode, record.deviceCode]
    .some(value => !!text(value));
  return hasIdentifiers ? 'unmatched-identifiers' : 'missing-identifiers';
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSourceId(
  type: 'call' | 'alarm',
  record: SwpCallRecord | SwpAlarmRecord,
): string {
  const explicit = type === 'call'
    ? [record.id, record.eventId, (record as SwpCallRecord).callId]
    : [record.id, record.eventId, (record as SwpAlarmRecord).alarmId];
  const sourceId = explicit.map(text).find(Boolean);
  if (sourceId) {
    const startedAt = type === 'call'
      ? text((record as SwpCallRecord).callStartTime)
      : text((record as SwpAlarmRecord).alarmStartTime);
    if (!startedAt)
      return sourceId;
    const occurrence = parseTimestamp(startedAt) || startedAt;
    return `${sourceId}:occ-${fnv1a(`${sourceId}|${occurrence}`)}`;
  }

  const fingerprint = type === 'call'
    ? [
        record.areaId,
        record.sickroomId,
        record.sickroomCode,
        record.bedCode,
        record.deviceCode,
        (record as SwpCallRecord).callStartTime,
        (record as SwpCallRecord).callFrom,
        (record as SwpCallRecord).callTo,
        (record as SwpCallRecord).callModeName,
      ]
    : [
        record.areaId,
        record.sickroomId,
        record.sickroomCode,
        record.bedCode,
        record.deviceCode,
        (record as SwpAlarmRecord).alarmStartTime,
        (record as SwpAlarmRecord).alarmType,
        (record as SwpAlarmRecord).deviceType,
      ];
  return `auto-${fnv1a(fingerprint.map(text).join('|'))}`;
}

function joinDescription(parts: unknown[]): string {
  return parts.map(text).filter(Boolean).join(' · ');
}

function formatCallMessage(value: unknown): string {
  const message = text(value);
  return /^(?:呼叫|患者呼叫|普通呼叫)$/.test(message) ? '' : message;
}

function formatCallLocation(location: SwpEventLocation): string {
  const bedName = text(location.bedName);
  const bedLabel = bedName
    ? bedName.endsWith('床') ? bedName : `${bedName}床`
    : '';
  return [location.roomName, bedLabel].filter(Boolean).join(' ');
}

function formatCallDescription(
  record: SwpCallRecord,
  location: SwpEventLocation | null,
): string {
  const message = formatCallMessage(record.callMessage);
  const source = text(record.callFromName) || text(record.callFrom);
  return joinDescription([
    `${location ? formatCallLocation(location) : source || '患者'}呼叫护士站`,
    message,
  ]);
}

function normalizeCall(
  record: SwpCallRecord,
  area: TwinAreaEntity,
  areaId: number,
): NormalizedSwpEvent {
  const location = findLocation(area, record);
  const locationSource = resolveLocationSource(area, record, location);
  const startedAt = text(record.callStartTime) || undefined;
  const timestampMs = parseTimestamp(record.callStartTime);
  return {
    id: `swp:call:${areaId}:${stableSourceId('call', record)}`,
    source: 'swp-call',
    areaId,
    taskType: 'call',
    severity: 'critical',
    startedAt,
    timestampMs,
    title: record.callModeName ? text(record.callModeName) : '患者呼叫',
    description: formatCallDescription(record, location),
    location,
    locationStatus: resolveLocationStatus(record, location),
    ...(locationSource ? { locationSource } : {}),
    locationLabel: location?.roomName || area.areaName,
  };
}

function normalizeAlarm(
  record: SwpAlarmRecord,
  area: TwinAreaEntity,
  areaId: number,
): NormalizedSwpEvent {
  const location = findLocation(area, record);
  const locationSource = resolveLocationSource(area, record, location);
  const startedAt = text(record.alarmStartTime) || undefined;
  const timestampMs = parseTimestamp(record.alarmStartTime);
  const alarmCodeOrLabel = text(record.alarmType);
  const hasReadableAlarmLabel = !!alarmCodeOrLabel && !/^\d+$/.test(alarmCodeOrLabel);
  const alarmTitle = hasReadableAlarmLabel ? alarmCodeOrLabel : '输液报警';
  return {
    id: `swp:alarm:${areaId}:${stableSourceId('alarm', record)}`,
    source: 'swp-alarm',
    areaId,
    taskType: 'infusion',
    severity: 'high',
    startedAt,
    timestampMs,
    title: alarmTitle,
    description: joinDescription([
      alarmTitle,
      alarmCodeOrLabel && !hasReadableAlarmLabel ? `报警代码 ${alarmCodeOrLabel}` : '',
      record.deviceType,
      record.deviceCode ? `设备 ${text(record.deviceCode)}` : '',
    ]),
    location,
    locationStatus: resolveLocationStatus(record, location),
    ...(locationSource ? { locationSource } : {}),
    locationLabel: location?.roomName || area.areaName,
  };
}

export function normalizeSwpEvents(options: NormalizeSwpEventsOptions): NormalizedSwpEvent[] {
  const events = [
    ...options.calls
      .filter(record => isActiveEvent(record.eventStatus) && belongsToArea(record.areaId, options.areaId))
      .map(record => normalizeCall(record, options.area, options.areaId)),
    ...options.alarms
      .filter(record => isActiveEvent(record.eventStatus) && belongsToArea(record.areaId, options.areaId))
      .map(record => normalizeAlarm(record, options.area, options.areaId)),
  ];
  const unique = new Map<string, NormalizedSwpEvent>();
  for (const event of events) {
    if (!unique.has(event.id))
      unique.set(event.id, event);
  }
  return [...unique.values()].sort((a, b) => b.timestampMs - a.timestampMs || a.id.localeCompare(b.id));
}

function parseDurationSeconds(value: string | number | undefined): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? value : null;
  const normalized = text(value);
  if (!normalized)
    return null;
  const clock = normalized.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (clock)
    return Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const seconds = normalized.match(/^([\d.]+)\s*秒$/);
  if (seconds)
    return Number(seconds[1]);
  const minutes = normalized.match(/^([\d.]+)\s*分(?:钟)?$/);
  if (minutes)
    return Number(minutes[1]) * 60;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function summarizeSwpResponseMetrics(
  records: SwpResponseTimelinessRecord[],
): SwpResponseMetrics {
  let arrivedCallCount = 0;
  let arrivalCount = 0;
  const responseSeconds: number[] = [];
  let latestCallAt: string | null = null;
  let latestTimestamp = 0;

  for (const record of records) {
    const arrivals = record.swpUwbTimeOfArrivalVoList ?? [];
    const personnel = text(record.personnelOnArrivals);
    if (arrivals.length || (personnel && personnel !== '接听未到场'))
      arrivedCallCount += 1;
    arrivalCount += arrivals.length;
    for (const arrival of arrivals) {
      const duration = parseDurationSeconds(arrival.efficiencyOfResponse);
      if (duration != null)
        responseSeconds.push(duration);
    }
    const timestamp = parseTimestamp(record.callStartTime);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestCallAt = text(record.callStartTime) || null;
    }
  }

  return {
    callCount: records.length,
    arrivedCallCount,
    unattendedCallCount: records.length - arrivedCallCount,
    arrivalCount,
    averageResponseSeconds: responseSeconds.length
      ? Math.round(responseSeconds.reduce((sum, value) => sum + value, 0) / responseSeconds.length)
      : null,
    latestCallAt,
  };
}
