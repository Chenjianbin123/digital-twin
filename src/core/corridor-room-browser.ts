import type { AlertTask } from './alert-workflow.ts';
import type { RoomSummary } from './area-summary.ts';
import type { StatusHistoryEntry, TwinAreaEntity } from '../types/twin.ts';

export type CorridorRoomFilter = 'all' | 'vacant' | 'attention';

/** 名称仅用于检索，定位必须用当前病区内唯一的业务标识。 */
export function resolveCorridorRoom(
  area: TwinAreaEntity | null,
  location: { roomCode?: string; bedCode?: string; canLocate?: boolean },
): number | null {
  if (!area || location.canLocate === false)
    return null;
  const roomCode = location.roomCode?.trim();
  const bedCode = location.bedCode?.trim();
  if (!roomCode && !bedCode)
    return null;
  const candidates = area.rooms.map((room, index) => ({ room, index }))
    .filter(({ room }) => roomCode ? room.sickroomCode === roomCode : room.beds.some(bed => bed.bedCode === bedCode));
  if (candidates.length !== 1)
    return null;
  const { room, index } = candidates[0]!;
  if (bedCode && room.beds.filter(bed => bed.bedCode === bedCode).length !== 1)
    return null;
  return index;
}

export function resolveHistoryRoom(entry: StatusHistoryEntry, area: TwinAreaEntity | null): number | null {
  // 无病区范围的旧记录不能证明属于当前病区，也不能退回房名匹配。
  if (!area?.areaCode || entry.areaCode !== area.areaCode)
    return null;
  return resolveCorridorRoom(area, entry);
}

export function attentionRoomCodes(area: TwinAreaEntity | null, tasks: readonly AlertTask[]): Set<string> {
  const codes = new Set<string>();
  for (const task of tasks) {
    const index = resolveCorridorRoom(area, task);
    if (index !== null)
      codes.add(area!.rooms[index]!.sickroomCode);
  }
  return codes;
}

function searchable(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, '');
}

export function filterCorridorRooms(
  summaries: readonly RoomSummary[], area: TwinAreaEntity | null,
  query: string, filter: CorridorRoomFilter, attentionCodes: ReadonlySet<string>,
): RoomSummary[] {
  const needle = searchable(query);
  return summaries.filter(summary => {
    if (filter === 'vacant' && summary.totalBeds <= summary.occupiedBeds)
      return false;
    if (filter === 'attention' && !(
      summary.callingCount > 0 || summary.offlineCount > 0 || (summary.lowBatteryCount ?? 0) > 0
      || summary.envAlertLevel !== 'normal' || attentionCodes.has(summary.sickroomCode)
    )) return false;
    if (!needle)
      return true;
    const index = resolveCorridorRoom(area, { roomCode: summary.sickroomCode });
    const beds = index === null ? [] : area!.rooms[index]!.beds;
    return [summary.sickroomName, summary.sickroomCode, ...beds.flatMap(bed => [bed.bedName, bed.bedCode])]
      .some(value => searchable(value).includes(needle));
  });
}
