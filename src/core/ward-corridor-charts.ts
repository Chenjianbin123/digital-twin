import type { RoomSummary } from './area-summary.ts';
import { bedUsageRatio } from './nurse-overview-charts.ts';
import type { InspectionRoomSummary } from '../types/inspection.ts';

export function buildCorridorChartData(
  rooms: readonly RoomSummary[],
  inspections: readonly InspectionRoomSummary[],
) {
  const inspectionByCode = new Map(inspections.map(item => [item.roomCode, item]));
  const rows = rooms.map(room => {
    const validCounts = Number.isInteger(room.totalBeds) && Number.isInteger(room.occupiedBeds)
      && room.totalBeds >= 0 && room.occupiedBeds >= 0 && room.occupiedBeds <= room.totalBeds;
    // 房间排序、筛选不能改变巡视记录归属；只按业务房间编码关联。
    const inspection = inspectionByCode.get(room.sickroomCode);
    const latestAt = inspection?.latestAt && Number.isFinite(Date.parse(inspection.latestAt))
      ? inspection.latestAt : null;
    return {
      code: room.sickroomCode,
      name: room.sickroomName,
      roomIndex: room.roomIndex,
      total: validCounts ? room.totalBeds : null,
      occupied: validCounts ? room.occupiedBeds : null,
      empty: validCounts ? room.totalBeds - room.occupiedBeds : null,
      latestAt,
      timeLabel: latestAt?.match(/(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)?.[1] ?? latestAt,
    };
  });
  const countsKnown = rows.every(row => row.total !== null);
  const total = countsKnown ? rows.reduce((sum, row) => sum + row.total!, 0) : null;
  const occupied = countsKnown ? rows.reduce((sum, row) => sum + row.occupied!, 0) : null;
  return {
    rows,
    total,
    occupied,
    empty: total !== null && occupied !== null ? total - occupied : null,
    ratio: total !== null && occupied !== null ? bedUsageRatio(occupied, total) : null,
    maxBeds: Math.max(1, ...rows.map(row => row.total ?? 0)),
    recorded: rows.filter(row => row.latestAt !== null).length,
    missing: rows.filter(row => row.latestAt === null).length,
  };
}
