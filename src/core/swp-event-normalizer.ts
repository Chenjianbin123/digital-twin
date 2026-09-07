import type {
  NormalizedSwpEvent,
  SwpAlarmRecord,
  SwpCallRecord,
  SwpEventLocation,
  SwpEventLocationSource,
  SwpEventLocationStatus,
  SwpIdentifier,
  NormalizedVitalMetric,
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
  'sickroomId' | 'sickroomCode' | 'sickroomName' | 'bedName' | 'bedCode' | 'deviceCode'
> & Partial<Pick<SwpCallRecord, 'callFrom'>>;

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function normalizedBedName(value: unknown): string {
  const normalized = text(value).replace(/\s+/g, '').replace(/床$/u, '');
  if (/^\d+$/u.test(normalized))
    return String(Number(normalized));
  return normalized;
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
  const sickroomName = text(record.sickroomName);
  const bedName = text(record.bedName);
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

  function addBedIdentifier(
    value: string,
    pick: (bed: TwinAreaEntity['rooms'][number]['beds'][number]) => unknown,
    normalize: (candidate: unknown) => string = text,
  ) {
    if (!value)
      return;
    const matches: Array<{ roomIndex: number; bedIndex: number }> = [];
    area.rooms.forEach((room, roomIndex) => {
      room.beds.forEach((bed, bedIndex) => {
        const candidate = normalize(pick(bed));
        const expected = normalize(value);
        if (candidate === expected)
          matches.push({ roomIndex, bedIndex });
      });
    });
    const scopedMatches = roomMatches.length === 1
      ? matches.filter(match => match.roomIndex === roomMatches[0])
      : matches;
    if (roomMatches.length === 1 && matches.length > 0 && scopedMatches.length === 0) {
      // Explicit room and bed identities disagree; do not silently downgrade
      // to a room-only location or guess a bed from another room.
      ambiguous = true;
    }
    else if (scopedMatches.length > 1)
      ambiguous = true;
    else if (scopedMatches.length === 1)
      bedMatches.push(scopedMatches[0]);
  }

  addRoomIdentifier(sickroomId, room => room.sickroomId);
  addRoomIdentifier(sickroomCode, room => room.sickroomCode);
  addRoomIdentifier(sickroomName, room => room.sickroomName);
  addRoomIdentifier(deviceCode, room => room.deviceCode);
  addBedIdentifier(bedName, bed => bed.bedName, normalizedBedName);
  addBedIdentifier(bedCode, bed => bed.bedCode);
  addBedIdentifier(deviceCode, bed => bed.deviceCode);

  if (!sickroomId && !sickroomCode && !sickroomName && !bedName && !bedCode && !deviceCode) {
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
  const sickroomName = text(record.sickroomName);
  const bedName = text(record.bedName);
  const bedCode = text(record.bedCode);
  const deviceCode = text(record.deviceCode);
  if (sickroomId && sickroomId === text(room?.sickroomId))
    return 'sickroom-id';
  if (sickroomName && sickroomName === text(room?.sickroomName))
    return 'sickroom-name';
  if (bedCode && bedCode === text(bed?.bedCode))
    return 'bed-code';
  if (bedName && normalizedBedName(bedName) === normalizedBedName(bed?.bedName))
    return 'bed-name';
  if (
    deviceCode
    && (deviceCode === text(room?.deviceCode) || deviceCode === text(bed?.deviceCode))
  )
    return 'device-code';
  if (sickroomCode && sickroomCode === text(room?.sickroomCode))
    return 'sickroom-code';

  if (!sickroomId && !sickroomCode && !sickroomName && !bedName && !bedCode && !deviceCode) {
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
  const hasIdentifiers = [
    record.sickroomId,
    record.sickroomCode,
    record.sickroomName,
    record.bedName,
    record.bedCode,
    record.deviceCode,
  ]
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
        record.sickroomName,
        record.bedName,
        record.bedCode,
        record.deviceCode,
        (record as SwpCallRecord).callStartTime,
        (record as SwpCallRecord).callFrom,
        (record as SwpCallRecord).callTo,
        (record as SwpCallRecord).callModeName,
        (record as SwpCallRecord).callMessage,
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

const VITAL_METRIC_LABELS: Record<NormalizedVitalMetric, string> = {
  temperature: '体温',
  heartRate: '心率',
  respiratoryRate: '呼吸',
  bloodPressure: '血压',
  bloodOxygen: '血氧',
  bloodSugar: '血糖',
  mews: 'MEWS',
  unknown: '体征',
};

function recordValue(record: SwpCallRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    const normalized = text(value);
    if (normalized)
      return normalized;
  }
  return '';
}

function cleanVitalValue(value: string): { value: string; unit: string } {
  const normalized = value.trim();
  if (!normalized)
    return { value: '', unit: '' };
  const match = normalized.match(/^(-?[\d.]+(?:\s*\/\s*-?[\d.]+)?)\s*(.*)$/);
  if (!match)
    return { value: normalized, unit: '' };
  return {
    value: match[1].replace(/\s+/g, ''),
    unit: match[2].trim(),
  };
}

function vitalMetricFromText(value: string): NormalizedVitalMetric {
  if (/血氧|氧饱和|spo2|oxygen/i.test(value))
    return 'bloodOxygen';
  if (/心率|脉搏|ecg|heart\s*rate|pulse/i.test(value))
    return 'heartRate';
  if (/呼吸|呼吸频率|respiratory|breath/i.test(value))
    return 'respiratoryRate';
  if (/血压|收缩压|舒张压|pressure|ssy|szy/i.test(value))
    return 'bloodPressure';
  if (/血糖|glucose|sugar/i.test(value))
    return 'bloodSugar';
  if (/体温|温度|temperature|\btw\b/i.test(value))
    return 'temperature';
  if (/mews/i.test(value))
    return 'mews';
  return 'unknown';
}

function vitalField(
  record: SwpCallRecord,
  metric: NormalizedVitalMetric,
): { value: string; unit: string } {
  const keys: Record<Exclude<NormalizedVitalMetric, 'unknown'>, string[]> = {
    temperature: ['temperature', 'temperatureBody', 'temp', 'tw'],
    heartRate: ['heartRate', 'rateHeart', 'pulse', 'ecg'],
    respiratoryRate: ['respiratoryRate', 'breath', 'respiratory', 'hx'],
    bloodPressure: ['bloodPressure', 'pressure', 'ssy', 'systolicBp'],
    bloodOxygen: ['bloodOxygen', 'oxygenBlood', 'spo2', 'blood_oxygen', 'oxygen'],
    bloodSugar: ['bloodSugar', 'glucose', 'blood_sugar'],
    mews: ['mewsScore', 'mews', 'score'],
  };
  const raw = recordValue(record, keys[metric as Exclude<NormalizedVitalMetric, 'unknown'>] ?? []);
  return cleanVitalValue(raw);
}

function parseVitalText(value: string): { metric: NormalizedVitalMetric; value: string; unit: string } | null {
  const normalized = value.trim();
  if (!normalized)
    return null;
  const metric = vitalMetricFromText(normalized);
  if (metric === 'unknown')
    return null;
  const cleaned = cleanVitalValue(
    normalized
      .replace(/^(?:生命体征预警|体征报警|生命体征)\s*[:：-]?\s*/i, '')
      .replace(/^(?:体温|温度|心率|脉搏|呼吸(?:频率)?|血压|收缩压|舒张压|血氧(?:饱和度)?|spo2|血糖|mews)\s*[:：]?\s*/i, ''),
  );
  return {
    metric,
    value: cleaned.value,
    unit: cleaned.unit,
  };
}

export function isVitalSignsCall(record: SwpCallRecord): boolean {
  const code = text(record.callModeCode);
  const label = text(record.callModeName);
  return code === '8' || /体征|生命体征|mews/i.test(label);
}

interface VitalDetails {
  metric: NormalizedVitalMetric;
  value?: string;
  unit?: string;
  threshold?: string;
  summary: string;
}

function extractVitalDetails(record: SwpCallRecord): VitalDetails {
  const fields: Array<{
    metric: Exclude<NormalizedVitalMetric, 'unknown' | 'mews'>;
    label: string;
  }> = [
    { metric: 'temperature', label: '体温' },
    { metric: 'heartRate', label: '心率' },
    { metric: 'respiratoryRate', label: '呼吸' },
    { metric: 'bloodPressure', label: '血压' },
    { metric: 'bloodOxygen', label: '血氧' },
    { metric: 'bloodSugar', label: '血糖' },
  ];
  const values: Array<{ metric: NormalizedVitalMetric; value: string; unit: string; label: string }> = [];
  for (const field of fields) {
    const direct = vitalField(record, field.metric);
    if (direct.value)
      values.push({ ...direct, metric: field.metric, label: field.label });
  }

  const mews = vitalField(record, 'mews');
  if (mews.value)
    values.push({ ...mews, metric: 'mews', label: VITAL_METRIC_LABELS.mews });

  const messages = [recordValue(record, ['callMessage']), recordValue(record, ['remark'])]
    .filter(Boolean);
  for (const message of messages) {
    const parsed = parseVitalText(message);
    if (parsed?.value) {
      const existing = values.find(item => item.metric === parsed.metric && item.value === parsed.value);
      if (existing) {
        if (!existing.unit && parsed.unit)
          existing.unit = parsed.unit;
      }
      else {
        values.push({ ...parsed, label: VITAL_METRIC_LABELS[parsed.metric] });
      }
    }
  }

  const threshold = recordValue(record, [
    'vitalThreshold',
    'warningThreshold',
    'warnThreshold',
    'threshold',
    'limit',
  ]);
  const alarmLevel = recordValue(record, [
    'mewsAlarmLevel',
    'vitalAlarmLevel',
    'alarmLevel',
    'warningLevel',
  ]);
  const summaryParts = [
    alarmLevel ? `风险${alarmLevel}` : '',
    ...values.map(item => `${item.label} ${item.value}${item.unit}`),
  ].filter(Boolean);
  const summary = values.length
    ? summaryParts.join(' · ')
    : alarmLevel
      ? `风险${alarmLevel}`
      : messages[0] || '生命体征出现异常，请及时评估患者';
  const primary = values[0];
  return {
    metric: primary?.metric ?? 'unknown',
    value: primary?.value,
    unit: primary?.unit,
    threshold: threshold || undefined,
    summary,
  };
}

function formatCallDescription(
  record: SwpCallRecord,
  location: SwpEventLocation | null,
  vitalDetails?: VitalDetails,
): string {
  const message = formatCallMessage(record.callMessage);
  const source = text(record.callFromName) || text(record.callFrom);
  const subject = location ? formatCallLocation(location) : source || '患者';
  return joinDescription([
    vitalDetails ? `${subject}检测到生命体征异常` : `${subject}呼叫护士站`,
    vitalDetails?.summary || message,
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
  const isVital = isVitalSignsCall(record);
  const vitalDetails = isVital ? extractVitalDetails(record) : undefined;
  return {
    id: `swp:call:${areaId}:${stableSourceId('call', record)}`,
    source: 'swp-call',
    areaId,
    taskType: isVital ? 'vital' : 'call',
    severity: 'critical',
    startedAt,
    timestampMs,
    title: isVital ? '生命体征预警' : record.callModeName ? text(record.callModeName) : '患者呼叫',
    description: formatCallDescription(record, location, vitalDetails),
    location,
    locationStatus: resolveLocationStatus(record, location),
    ...(locationSource ? { locationSource } : {}),
    locationLabel: location?.roomName || area.areaName,
    ...(vitalDetails ? {
      vitalMetric: vitalDetails.metric,
      ...(vitalDetails.value ? { vitalValue: vitalDetails.value } : {}),
      ...(vitalDetails.unit ? { vitalUnit: vitalDetails.unit } : {}),
      ...(vitalDetails.threshold ? { vitalThreshold: vitalDetails.threshold } : {}),
    } : {}),
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
