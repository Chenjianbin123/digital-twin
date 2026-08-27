import type { RoomPriority, RoomSummary } from '@/core/area-summary';

const PRIORITY_RANK: Record<RoomPriority, number> = {
  calling: 0,
  danger: 1,
  offline: 2,
  infusing: 3,
  warning: 4,
  normal: 5,
  empty: 6,
};

export function selectNurseStationMarkers(
  summaries: RoomSummary[],
  limit = 6,
): RoomSummary[] {
  const count = Math.max(0, Math.floor(limit));
  return summaries
    .map((summary, sourceIndex) => ({ summary, sourceIndex }))
    .sort((a, b) =>
      PRIORITY_RANK[a.summary.priority] - PRIORITY_RANK[b.summary.priority]
      || a.sourceIndex - b.sourceIndex,
    )
    .slice(0, count)
    .map(item => item.summary);
}
