import type { InspectionAssociation, SwpInspectionRecord } from '../types/inspection.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const text = (value: unknown) => String(value ?? '').trim();

// Diagnostic candidates explain mismatches, but must never become automatic bindings.
export function inspectionAssociationIssue(record: SwpInspectionRecord, area: TwinAreaEntity, reason: string): InspectionAssociation['issues'][number] {
  const roomName = text(record.sickroomName), bedName = text(record.bedName);
  const namedRooms = area.rooms.filter(room => text(room.sickroomName) === roomName);
  const currentBeds = namedRooms.length === 1 ? namedRooms[0].beds.map(bed => text(bed.bedName)).filter(Boolean) : [];
  const otherRooms = bedName ? area.rooms.filter(room => text(room.sickroomName) !== roomName
    && room.beds.some(bed => text(bed.bedName) === bedName)).map(room => room.sickroomName) : [];
  return { roomName, bedName, reason, count: 1, currentBeds, otherRooms };
}
