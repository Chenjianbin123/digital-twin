import type { RoomSummary } from './area-summary.ts';
import type { NurseStationLiveData } from './nurse-station-live-data.ts';
import type { NurseStationViewModel } from './nurse-station-view-model.ts';
import type { ReferenceBoardKind } from './reference-nurse-station.ts';

/** Match visible fields only: refreshed timestamps or unrelated patient data must not repaint screens. */
export function buildReferenceBoardSignatures(input: {
  viewModel: NurseStationViewModel | null;
  metrics: NurseStationLiveData;
  summaries: readonly RoomSummary[];
  areaName: string;
  darkTheme: boolean;
}, nowMs: number): Record<ReferenceBoardKind, string> {
  const { viewModel: vm, metrics: m, summaries, areaName, darkTheme } = input;
  const available = (key: string) => {
    const source = vm?.dataFreshnessItems.find(item => item.key === key);
    return Boolean(source && (source.status === 'ready' || source.syncedAt));
  };
  const rank = { calling: 0, danger: 1, offline: 2, infusing: 3, warning: 4, normal: 5, empty: 6 };
  const rows = [...summaries].sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 3)
    .map(room => [room.sickroomName, room.occupiedBeds, room.totalBeds, room.statusText, room.accentColor]);
  const signature = (...fields: unknown[]) => JSON.stringify([darkTheme, ...fields]);
  // Workstation headings show HH:mm; only the analogue clock needs a second tick.
  const minute = Math.floor(nowMs / 60000);
  return {
    dashboard: signature(areaName, available('ward'), available('events'), vm?.realtime.status, vm?.realtime.label,
      m.occupiedBeds, m.totalBeds, m.rooms, m.callingCount, m.deviceOnline, vm?.metrics.vitalWarnings, m.emptyBeds, m.deviceTotal),
    taskQueue: signature(minute, m.callingCount, m.offlineBedCount, m.envWarningCount, rows[0]),
    wardStatus: signature(minute, rows),
    bedMonitor: signature(minute, m.occupiedBeds, m.totalBeds, m.infusingCount, m.emptyBeds, m.occupiedRate),
    deviceHealth: signature(minute, m.deviceHealthRate, m.offlineBedCount, m.envWarningCount),
    clock: String(Math.floor(nowMs / 1000)),
  };
}
