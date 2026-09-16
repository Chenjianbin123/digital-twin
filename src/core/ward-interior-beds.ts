import type { TwinBedEntity, TwinWardEntity } from '../types/twin.ts';

/** Room identity complements the area session which owns WardScene. */
export function wardInteriorRoomKey(ward: TwinWardEntity): string {
  return JSON.stringify([ward.sickroomId, ward.sickroomCode, ward.deviceCode]);
}

export function selectOccupiedWardBeds(ward: TwinWardEntity) {
  const occupied = ward.beds.filter(bed => bed.isOccupied);
  const counts = new Map<string, number>();
  for (const bed of occupied) {
    const code = bed.bedCode.trim();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  // Ambiguous identities must not be attached to a patient's screen.
  const beds = occupied.filter(bed => bed.bedCode.trim() && counts.get(bed.bedCode.trim()) === 1)
    .sort((a, b) => a.bedName.localeCompare(b.bedName, 'zh-CN', { numeric: true })
      || a.bedCode.localeCompare(b.bedCode));
  return { beds, occupiedCount: occupied.length, invalidCount: occupied.length - beds.length };
}

export function isWardBedInfusing(bed: TwinBedEntity): boolean {
  // Calling has higher display priority, but does not stop an ongoing infusion.
  return bed.isOccupied && ['300', '301'].includes(String(bed.statusBarInfo?.status ?? ''));
}
