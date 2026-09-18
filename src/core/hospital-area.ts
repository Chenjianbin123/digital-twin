import type { HospAreaRawRecord, HospAreaRecord } from '../types/hospital-area.ts';
import { getWardBedStats, type TwinAreaEntity } from '../types/twin.ts';

function optionalCount(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === '')
      continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0)
      return Math.floor(numeric);
  }
}

export function summarizeTwinAreaOccupancy(area: TwinAreaEntity): Pick<
  HospAreaRecord,
  'roomCount' | 'bedCount' | 'occupiedCount' | 'peopleCount' | 'deviceCount'
> {
  let bedCount = 0;
  let occupiedCount = 0;
  let deviceCount = 0;
  for (const room of area.rooms) {
    const stats = getWardBedStats(room);
    bedCount += stats.total;
    occupiedCount += stats.occupied;
    if (room.isOnline === true)
      deviceCount += 1;
    deviceCount += room.beds.filter(bed => bed.isOnline).length;
  }
  return {
    roomCount: area.rooms.length,
    bedCount,
    occupiedCount,
    peopleCount: occupiedCount,
    deviceCount,
  };
}

export function normalizeHospitalAreaRecords(records: HospAreaRawRecord[]): HospAreaRecord[] {
  const seen = new Set<number>();
  const result: HospAreaRecord[] = [];
  for (const raw of records) {
    const id = Number(raw.id ?? 0);
    const areaName = String(raw.areaName ?? '').trim();
    if (!Number.isFinite(id) || id <= 0 || !areaName || raw.isEnable === '0' || seen.has(id))
      continue;
    seen.add(id);
    const roomCount = optionalCount(raw.roomCount, raw.roomNum);
    const bedCount = optionalCount(raw.bedCount, raw.bedNum);
    const occupiedCount = optionalCount(
      raw.occupiedCount,
      raw.sickNum,
      raw.patientNum,
      raw.patientCount,
    );
    const peopleCount = optionalCount(raw.peopleCount, raw.peopleNum, occupiedCount);
    const deviceCount = optionalCount(raw.deviceCount, raw.deviceNum);
    result.push({
      id,
      areaName,
      areaCode: String(raw.areaCode ?? '').trim(),
      areaOutCode: String(raw.areaOutCode ?? '').trim(),
      isEnable: String(raw.isEnable ?? '1'),
      roomCount: roomCount ?? 0,
      bedCount: bedCount ?? 0,
      occupiedCount: occupiedCount ?? 0,
      peopleCount: peopleCount ?? occupiedCount ?? 0,
      deviceCount: deviceCount ?? 0,
    });
  }
  return result;
}

export function areaMetricValue(
  area: Pick<HospAreaRecord, 'roomCount' | 'bedCount' | 'occupiedCount' | 'peopleCount' | 'deviceCount'>,
  key: 'roomCount' | 'bedCount' | 'occupiedCount' | 'peopleCount' | 'deviceCount',
): number {
  const value = area[key];
  return value != null && Number.isFinite(value) ? Number(value) : 0;
}
