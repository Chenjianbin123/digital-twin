import type { SwpInspectionRecord } from '../types/inspection.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const text = (value: unknown) => String(value ?? '').trim();

/** Strong identifiers must agree; names are a fallback only inside the requested ward. */
export function locateInspection(record: SwpInspectionRecord, area: TwinAreaEntity, areaId?: number) {
  if (areaId != null && text(record.areaId) && text(record.areaId) !== String(areaId))
    return { reason: '记录不属于当前病区' } as const;
  const id = text(record.sickroomId);
  const code = text(record.sickroomCode);
  const name = text(record.sickroomName);
  const bedCode = text(record.bedCode);
  const bedName = text(record.bedName);
  const rooms = area.rooms.map((room, roomIndex) => ({ room, roomIndex })).filter(({ room }) => {
    if (id || code)
      return (!id || text(room.sickroomId) === id) && (!code || text(room.sickroomCode) === code);
    if (name)
      return text(room.sickroomName) === name;
    return !!bedCode && room.beds.some(bed => text(bed.bedCode) === bedCode);
  });
  if (rooms.length !== 1)
    return { reason: rooms.length ? '病房信息不唯一' : '病房标识缺失、冲突或未匹配' } as const;
  const { room, roomIndex } = rooms[0];
  if (name && text(room.sickroomName) !== name)
    return { reason: '病房名称与标识不一致' } as const;
  if (!bedCode && !bedName)
    return { room, roomIndex, bed: undefined };
  const beds = room.beds.filter(bed =>
    (!bedCode || text(bed.bedCode) === bedCode) && (!bedName || text(bed.bedName) === bedName));
  if (beds.length !== 1)
    return { reason: beds.length ? '床位信息不唯一' : '床位标识冲突或未匹配' } as const;
  return { room, roomIndex, bed: beds[0] };
}
