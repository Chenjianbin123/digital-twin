import { analyzeEnvAlert } from './env-alert.ts';
import type { DataSource } from './data-source.ts';
import type { TwinWardEntity } from '../types/twin.ts';

export const ENV_ROOM_POLL_MS = 60_000;
export const ENV_AREA_POLL_MS = 120_000;
export const ENV_MAX_CONCURRENT_REQUESTS = 4;
export const ENV_STALE_AFTER_MS = 5 * 60_000;

type EnvironmentRoom = Pick<TwinWardEntity, 'doorEnvData' | 'envSync'>;
export type EnvironmentStatus = 'fresh' | 'stale' | 'error' | 'unknown' | 'missing' | 'demo' | 'snapshot';

function hasReading(room: EnvironmentRoom): boolean {
  return Object.values(room.doorEnvData ?? {}).some(value => value != null && String(value).trim() !== '');
}

/** 接收时间只说明接口同步情况，不代表传感器的采样时间。 */
export function resolveEnvironmentStatus(
  room: EnvironmentRoom,
  nowMs = Date.now(),
  dataSource: DataSource = 'remote',
): EnvironmentStatus {
  if (dataSource === 'remote' && room.envSync?.failed) return 'error';
  if (!hasReading(room)) return 'missing';
  if (dataSource === 'mock') return 'demo';
  if (dataSource === 'database') return 'snapshot';
  const receivedAt = room.envSync?.lastSuccessAt;
  if (receivedAt == null || !Number.isFinite(receivedAt) || receivedAt < 0 || receivedAt > nowMs)
    return 'unknown';
  return nowMs - receivedAt >= ENV_STALE_AFTER_MS ? 'stale' : 'fresh';
}

export function formatEnvironmentSyncText(
  room: EnvironmentRoom,
  nowMs = Date.now(),
  dataSource: DataSource = 'remote',
): string {
  const status = resolveEnvironmentStatus(room, nowMs, dataSource);
  const receivedAt = room.envSync?.lastSuccessAt;
  const time = receivedAt != null && Number.isFinite(receivedAt) && receivedAt >= 0 && receivedAt <= nowMs
    ? new Date(receivedAt).toLocaleTimeString('zh-CN', { hour12: false }) : null;
  if (status === 'demo') return '';
  if (status === 'snapshot') return '数据库快照 · 采样时间未知';
  if (status === 'error') return time ? `更新失败 · 上次接收 ${time}，仅供参考` : '暂未获取环境数据';
  if (status === 'stale') return `数据已过期 · 上次接收 ${time}，仅供参考`;
  if (status === 'fresh') return `最近接收 ${time}`;
  return status === 'missing' ? '等待环境数据' : '更新时间未知';
}

export interface EnvironmentSummary {
  temperature: number | null;
  humidity: number | null;
  validRooms: number;
  pendingRooms: number;
  warningRooms: number;
  unverifiedWarningRooms: number;
  totalRooms: number;
  source: DataSource;
}

function numericReading(value: string | number | undefined): number | null {
  if (value == null) return null;
  const text = String(value).replace(/℃|°C|%/gi, '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function buildEnvironmentSummary(
  rooms: readonly EnvironmentRoom[],
  nowMs = Date.now(),
  dataSource: DataSource = 'remote',
): EnvironmentSummary {
  const temperatures: number[] = [];
  const humidities: number[] = [];
  let validRooms = 0;
  let warningRooms = 0;
  let unverifiedWarningRooms = 0;
  for (const room of rooms) {
    const status = resolveEnvironmentStatus(room, nowMs, dataSource);
    const warning = analyzeEnvAlert(room.doorEnvData).level !== 'normal';
    if (status !== 'fresh' && status !== 'demo' && status !== 'snapshot') {
      if (warning) unverifiedWarningRooms++;
      continue;
    }
    validRooms++;
    if (warning) warningRooms++;
    const temperature = numericReading(room.doorEnvData?.temp);
    const humidity = numericReading(room.doorEnvData?.relativeHumid);
    if (temperature != null) temperatures.push(temperature);
    if (humidity != null) humidities.push(humidity);
  }
  const average = (values: number[]) => values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
  return {
    temperature: average(temperatures),
    humidity: average(humidities),
    validRooms,
    pendingRooms: rooms.length - validRooms,
    warningRooms,
    unverifiedWarningRooms,
    totalRooms: rooms.length,
    source: dataSource,
  };
}

/** 设备快照没有环境接收时间，不能用它覆盖已确认的独立环境读数。 */
export function retainEnvironmentReadings(
  nextRooms: TwinWardEntity[],
  previousRooms: readonly TwinWardEntity[],
): void {
  for (const room of nextRooms) {
    if (room.envSync || !room.sickroomId) continue;
    const matches = previousRooms.filter(previous => previous.sickroomId === room.sickroomId
      && previous.deviceCode === room.deviceCode);
    if (matches.length !== 1) continue;
    const previous = matches[0];
    if (!previous.envSync || !previous.doorEnvData) continue;
    room.doorEnvData = { ...previous.doorEnvData };
    room.envSync = { ...previous.envSync };
  }
}
