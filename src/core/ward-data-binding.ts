import type { TwinAreaEntity, TwinBedEntity } from '../types/twin.ts';

/** Device identity disambiguates room-local bed numbers. Reject conflicting or ambiguous events. */
export function findUniqueStatusBed(area: TwinAreaEntity, bedCode: string, deviceCode?: string) {
  const code = bedCode.trim();
  const device = deviceCode?.trim();
  if (!code && !device) return null;
  const matches = area.rooms.flatMap(room => room.beds
    .filter(bed => (!code || bed.bedCode.trim() === code) && (!device || bed.deviceCode.trim() === device))
    .map(bed => ({ room, bed })));
  return matches.length === 1 ? matches[0]! : null;
}

/** Compare both normalized and endpoint identities so enrichment cannot conceal a patient change. */
export function wardBedPatientKey(bed: TwinBedEntity): string {
  const identity = (patient: object | null | undefined) => {
    const record = (patient ?? {}) as Record<string, unknown>;
    return ['sickIdentifier', 'sickSerialNo', 'sickNo', 'sickInTime', 'sickName']
      .map(key => String(record[key] ?? '').trim());
  };
  return JSON.stringify([bed.deviceCode, bed.isOccupied, identity(bed.sickInfo), identity(bed.bedSickInfo)]);
}
