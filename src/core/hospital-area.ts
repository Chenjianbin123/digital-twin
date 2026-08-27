import type { HospAreaRawRecord, HospAreaRecord } from '../types/hospital-area.ts';

export function normalizeHospitalAreaRecords(records: HospAreaRawRecord[]): HospAreaRecord[] {
  const seen = new Set<number>();
  const result: HospAreaRecord[] = [];
  for (const raw of records) {
    const id = Number(raw.id ?? 0);
    const areaName = String(raw.areaName ?? '').trim();
    if (!Number.isFinite(id) || id <= 0 || !areaName || raw.isEnable === '0' || seen.has(id))
      continue;
    seen.add(id);
    result.push({
      id,
      areaName,
      areaCode: String(raw.areaCode ?? '').trim(),
      areaOutCode: String(raw.areaOutCode ?? '').trim(),
      isEnable: String(raw.isEnable ?? '1'),
    });
  }
  return result;
}
