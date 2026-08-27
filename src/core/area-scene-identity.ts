import type { TwinAreaEntity, TwinWardEntity } from '@/types/twin';

export function buildAreaSceneIdentity(areaId: number | null): string {
  return areaId == null ? 'area:none' : `area:${areaId}`;
}

export function buildRoomStructureSignature(room: TwinWardEntity): string {
  const roomId = room.sickroomId || room.deviceCode || room.sickroomCode;
  const beds = room.beds.map(bed => bed.deviceCode || bed.bedCode).join(',');
  return `${roomId}[${beds}]`;
}

export function buildAreaStructureSignature(area: TwinAreaEntity): string {
  return area.rooms.map(buildRoomStructureSignature).join('|');
}
