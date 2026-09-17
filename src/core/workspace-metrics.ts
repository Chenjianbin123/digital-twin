import type { HospitalInfo } from '../types/hospital.ts';
import { getWardBedStats, type TwinAreaEntity } from '../types/twin.ts';

export interface KeyMetric {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
}

export function getAreaTemperature(area: TwinAreaEntity | null): string | undefined {
  for (const room of area?.rooms ?? []) {
    const raw = String(room.doorEnvData?.temp ?? '').replace(/℃|°C/g, '').trim();
    if (raw && Number.isFinite(Number(raw))) return raw;
  }
}

export function buildWorkspaceMetrics(area: TwinAreaEntity | null, hospital: HospitalInfo | null): KeyMetric[] {
  if (!area) return [];
  let totalBeds = 0;
  let occupied = 0;
  let onlineDevices = 0;
  for (const room of area.rooms) {
    const stats = getWardBedStats(room);
    totalBeds += stats.total;
    occupied += stats.occupied;
    if (room.isOnline === true) onlineDevices++;
    onlineDevices += room.beds.filter(bed => bed.isOnline).length;
  }
  const rows: KeyMetric[] = [];
  const hospitalBeds = hospital?.bedNum;
  const hasHospitalBeds = hospitalBeds != null && Number.isFinite(hospitalBeds) && hospitalBeds >= 0;
  // Hospital capacity and current-area occupancy are different denominators.
  rows.push({ key: 'bed', label: hasHospitalBeds ? '医院开放床位' : '病区床位', value: hasHospitalBeds ? hospitalBeds : totalBeds, unit: '张' });
  const temperature = getAreaTemperature(area);
  if (temperature !== undefined) rows.push({ key: 'temp', label: '室内温度', value: temperature, unit: '℃' });
  rows.push({ key: 'rooms', label: '病区房间', value: area.rooms.length, unit: '间' });
  rows.push({ key: 'device', label: '在线设备', value: onlineDevices, unit: '台' });
  rows.push({ key: 'patient', label: '病区在院患者', value: occupied, unit: '人' });
  if (totalBeds > 0) rows.push({ key: 'rate', label: '病区入住率', value: Math.round(occupied / totalBeds * 100), unit: '%' });
  return rows;
}
