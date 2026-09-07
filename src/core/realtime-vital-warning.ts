import type { SwpCallRecord } from '../types/swp-events.ts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(record[key]);
    if (value)
      return value;
  }
  return '';
}

function valueWithUnit(value: unknown, fallbackUnit = ''): string {
  const normalized = text(value);
  if (!normalized)
    return '';
  if (/[^\d\s./-]/.test(normalized))
    return normalized;
  return `${normalized}${fallbackUnit}`;
}

function buildVitalMessage(message: Record<string, unknown>): string {
  const score = firstText(message, ['mewsScore', 'mews', 'score']);
  const level = firstText(message, ['mewsAlarmLevel', 'alarmLevel', 'warningLevel']);
  const values = [
    ['体温', ['tw', 'temperature', 'temperatureBody'], '℃'],
    ['心率', ['ecg', 'heartRate', 'pulse'], '次/分'],
    ['呼吸', ['hx', 'respiratoryRate', 'breath'], '次/分'],
    ['血压', ['bloodPressure', 'ssy', 'pressure'], 'mmHg'],
    ['血氧', ['bloodOxygen', 'oxygenBlood', 'spo2'], '%'],
    ['血糖', ['bloodSugar', 'glucose'], 'mmol/L'],
  ]
    .map(([label, keys, unit]) => {
      const value = valueWithUnit(firstText(message, keys as string[]), unit as string);
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean);

  return [
    score ? `MEWS ${score}分` : '',
    level ? `风险${level}` : '',
    ...values,
  ].filter(Boolean).join(' · ');
}

/**
 * 将管理机 RabbitMQ 的 sendMewsAlarm 消息转换为现有 SWP 呼叫事件契约。
 * 只接受真实体征推送，并要求至少存在病房/床位/设备身份之一。
 */
export function normalizeRealtimeVitalMessage(raw: unknown): SwpCallRecord | null {
  const root = asRecord(raw);
  const command = firstText(root, ['Cmd', 'cmd', 'command', 'type']);
  if (command !== 'sendMewsAlarm')
    return null;

  const message = asRecord(root.Message ?? root.message ?? root.payload);
  const areaId = firstText(message, ['areaId', 'areaID', 'area_id']) || firstText(root, ['areaId', 'areaID']);
  const sickroomId = firstText(message, ['sickroomId', 'sickroomID', 'sickroom_id']);
  const sickroomCode = firstText(message, ['sickroomCode', 'sickroom_code']);
  const sickroomName = firstText(message, ['sickroomName', 'sickroom_name', 'roomName']);
  const bedCode = firstText(message, ['bedCode', 'bed_code']);
  const bedName = firstText(message, ['bedName', 'bed_name']);
  const deviceCode = firstText(message, ['deviceCode', 'device_code']);
  if (!sickroomId && !sickroomCode && !sickroomName && !bedCode && !bedName && !deviceCode)
    return null;

  const startedAt = firstText(message, ['pushTime', 'alarmTime', 'occurredAt', 'createTime']);
  const sourceId = firstText(message, ['messageId', 'mewsAlarmId', 'eventId', 'id']);
  const callMessage = buildVitalMessage(message);
  const callFrom = bedCode || bedName || deviceCode || sickroomCode || sickroomId;
  return {
    id: sourceId || undefined,
    eventId: sourceId || undefined,
    areaId: areaId || undefined,
    sickroomId: sickroomId || undefined,
    sickroomCode: sickroomCode || undefined,
    sickroomName: sickroomName || undefined,
    bedCode: bedCode || undefined,
    bedName: bedName || undefined,
    deviceCode: deviceCode || undefined,
    callFrom: callFrom || undefined,
    ...(startedAt ? { callStartTime: startedAt } : {}),
    callModeCode: 8,
    callModeName: '体征报警',
    callMessage: callMessage || '生命体征出现异常，请及时评估患者',
    remark: firstText(message, ['remark', 'warningRemark', 'messageContent']) || undefined,
    eventStatus: '0',
    mewsScore: firstText(message, ['mewsScore', 'mews', 'score']) || undefined,
    mewsAlarmLevel: firstText(message, ['mewsAlarmLevel', 'alarmLevel', 'warningLevel']) || undefined,
    tw: firstText(message, ['tw', 'temperature', 'temperatureBody']) || undefined,
    ecg: firstText(message, ['ecg', 'heartRate', 'pulse']) || undefined,
    hx: firstText(message, ['hx', 'respiratoryRate', 'breath']) || undefined,
    ssy: firstText(message, ['ssy', 'systolicBp']) || undefined,
    szys: firstText(message, ['szys', 'consciousness']) || undefined,
    bloodOxygen: firstText(message, ['bloodOxygen', 'oxygenBlood', 'spo2']) || undefined,
    bloodSugar: firstText(message, ['bloodSugar', 'glucose']) || undefined,
  };
}
