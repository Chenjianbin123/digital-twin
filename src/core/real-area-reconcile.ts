import type { TwinAreaEntity, TwinWardEntity } from '../types/twin.ts';

export interface ReconciledAreaSnapshot {
  area: TwinAreaEntity;
  rooms: TwinWardEntity[];
  retainedDeviceCodes: string[];
}

export function reconcileRealAreaSnapshot(
  incoming: TwinAreaEntity,
  previous: TwinAreaEntity | null,
  discoveredDeviceCodes: readonly string[],
): ReconciledAreaSnapshot {
  if (!previous || previous.areaCode !== incoming.areaCode)
    return { area: incoming, rooms: incoming.rooms, retainedDeviceCodes: [] };

  const incomingByCode = new Map(incoming.rooms.map(room => [room.deviceCode, room]));
  const previousByCode = new Map(previous.rooms.map(room => [room.deviceCode, room]));
  const retainedDeviceCodes: string[] = [];
  const rooms = discoveredDeviceCodes.flatMap((deviceCode) => {
    const fresh = incomingByCode.get(deviceCode);
    if (fresh)
      return [fresh];
    const stale = previousByCode.get(deviceCode);
    if (!stale)
      return [];
    retainedDeviceCodes.push(deviceCode);
    return [stale];
  });
  const area = { ...incoming, rooms };
  return { area, rooms, retainedDeviceCodes };
}
