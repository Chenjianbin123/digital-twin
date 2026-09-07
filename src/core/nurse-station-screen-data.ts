import type { RoomSummary } from './area-summary.ts';
import type { NurseStationLiveData } from './nurse-station-live-data.ts';

export interface NurseStationScreenRow {
  roomName: string;
  detail: string;
  status: string;
  state: 'urgent' | 'attention' | 'normal';
  accentColor: string;
}

const PRIORITY_ORDER: Record<RoomSummary['priority'], number> = {
  calling: 0,
  danger: 1,
  offline: 2,
  infusing: 3,
  warning: 4,
  normal: 5,
  empty: 6,
};

const PRIORITY_LABEL: Record<RoomSummary['priority'], string> = {
  calling: '紧急',
  danger: '环境异常',
  offline: '设备离线',
  infusing: '输液巡视',
  warning: '环境预警',
  normal: '正常',
  empty: '空床',
};

function resolveState(priority: RoomSummary['priority']): NurseStationScreenRow['state'] {
  if (priority === 'calling' || priority === 'danger')
    return 'urgent';
  if (priority === 'offline' || priority === 'infusing' || priority === 'warning')
    return 'attention';
  return 'normal';
}

function sortRooms(summaries: readonly RoomSummary[]) {
  return [...summaries].sort((left, right) =>
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    || right.callingCount - left.callingCount
    || right.occupiedBeds - left.occupiedBeds
    || left.roomIndex - right.roomIndex,
  );
}

function buildPatientDetail(summary: RoomSummary) {
  const details = [`${summary.occupiedBeds}/${summary.totalBeds} 在床`];
  if (summary.callingCount > 0)
    details.push(`呼叫 ${summary.callingCount}`);
  if (summary.infusingCount > 0)
    details.push(`输液 ${summary.infusingCount}`);
  const lowBatteryCount = summary.lowBatteryCount ?? 0;
  const disconnectedCount = Math.max(0, summary.offlineCount - lowBatteryCount);
  if (disconnectedCount > 0)
    details.push(`离线 ${disconnectedCount}`);
  if (lowBatteryCount > 0)
    details.push(`低电量 ${lowBatteryCount}`);
  if (summary.envAlertLevel !== 'normal')
    details.push(summary.envAlertLevel === 'danger' ? '环境异常' : '环境预警');
  return details.join(' · ');
}

function buildHandoffDetail(summary: RoomSummary) {
  if (summary.callingCount > 0)
    return `呼叫 ${summary.callingCount} 项，需优先响应`;
  if (summary.priority === 'danger' || summary.envAlertLevel === 'danger')
    return '环境异常，请立即复核';
  if (summary.offlineCount > 0)
    return `设备离线 ${summary.offlineCount} 台，请巡检`;
  if (summary.infusingCount > 0)
    return `输液巡视 ${summary.infusingCount} 床，请按时复核`;
  if (summary.envAlertLevel === 'warning')
    return '环境预警，请安排复核';
  if (summary.occupiedBeds > 0)
    return `${summary.occupiedBeds}/${summary.totalBeds} 在床，暂无重点事项`;
  return '当前为空床';
}

function buildRows(
  summaries: readonly RoomSummary[],
  live: NurseStationLiveData,
  detail: (summary: RoomSummary) => string,
  emptyDetail: string,
): NurseStationScreenRow[] {
  if (!summaries.length || live.rooms <= 0) {
    return [{
      roomName: '病区',
      detail: emptyDetail,
      status: '待同步',
      state: 'normal',
      accentColor: '#4FC3F7',
    }];
  }

  return sortRooms(summaries).slice(0, 3).map((summary) => ({
    roomName: summary.sickroomName || summary.sickroomCode || '未命名病房',
    detail: detail(summary),
    status: summary.statusText || PRIORITY_LABEL[summary.priority],
    state: resolveState(summary.priority),
    accentColor: summary.accentColor || '#4FC3F7',
  }));
}

/** Builds up to three de-identified care items for the “护理交班” screen. */
export function buildNurseStationHandoffRows(
  summaries: readonly RoomSummary[],
  live: NurseStationLiveData,
): NurseStationScreenRow[] {
  return buildRows(summaries, live, buildHandoffDetail, '暂无重点事项');
}

/** Builds up to three room-level occupancy/status rows for the “患者状态” screen. */
export function buildNurseStationPatientRows(
  summaries: readonly RoomSummary[],
  live: NurseStationLiveData,
): NurseStationScreenRow[] {
  return buildRows(summaries, live, buildPatientDetail, '暂无患者数据');
}
