import type { RoomSummary } from '@/core/area-summary';
import { resolveBedStatus } from '@/core/bed-status';
import type { TwinAreaEntity } from '@/types/twin';

export type AlertQueueKind = 'call' | 'infusion' | 'offline' | 'lowBattery' | 'env';

export interface AlertQueueItem {
  id: string;
  kind: AlertQueueKind;
  roomIndex: number;
  roomName: string;
  bedCode?: string;
  bedName?: string;
  label: string;
  sortKey: number;
}

const KIND_ORDER: Record<AlertQueueKind, number> = {
  call: 0,
  env: 1,
  offline: 2,
  lowBattery: 3,
  infusion: 4,
};

/** 病区异常队列：呼叫 > 环境 > 离线 > 低电量 > 输液 */
export function buildWardAlertQueue(
  area: TwinAreaEntity,
  summaries: RoomSummary[],
): AlertQueueItem[] {
  const items: AlertQueueItem[] = [];

  for (const summary of summaries) {
    const room = area.rooms[summary.roomIndex];
    if (!room)
      continue;

    if (summary.envAlertLevel === 'danger') {
      items.push({
        id: `env-danger-${summary.roomIndex}`,
        kind: 'env',
        roomIndex: summary.roomIndex,
        roomName: summary.sickroomName,
        label: '环境异常',
        sortKey: KIND_ORDER.env,
      });
    }
    else if (summary.envAlertLevel === 'warning') {
      items.push({
        id: `env-warn-${summary.roomIndex}`,
        kind: 'env',
        roomIndex: summary.roomIndex,
        roomName: summary.sickroomName,
        label: '环境预警',
        sortKey: KIND_ORDER.env + 0.1,
      });
    }

    for (const bed of room.beds) {
      const status = resolveBedStatus(bed);
      if (bed.isCalling) {
        items.push({
          id: `call-${bed.bedCode}`,
          kind: 'call',
          roomIndex: summary.roomIndex,
          roomName: summary.sickroomName,
          bedCode: bed.bedCode,
          bedName: bed.bedName,
          label: '床位呼叫',
          sortKey: KIND_ORDER.call,
        });
      }
      else if (status.state === 'offline') {
        items.push({
          id: `offline-${bed.bedCode}`,
          kind: 'offline',
          roomIndex: summary.roomIndex,
          roomName: summary.sickroomName,
          bedCode: bed.bedCode,
          bedName: bed.bedName,
          label: '设备离线',
          sortKey: KIND_ORDER.offline,
        });
      }
      else if (status.state === 'lowBattery') {
        items.push({
          id: `battery-${bed.bedCode}`,
          kind: 'lowBattery',
          roomIndex: summary.roomIndex,
          roomName: summary.sickroomName,
          bedCode: bed.bedCode,
          bedName: bed.bedName,
          label: '低电量',
          sortKey: KIND_ORDER.lowBattery,
        });
      }
      else if (status.state === 'infusing') {
        items.push({
          id: `infuse-${bed.bedCode}`,
          kind: 'infusion',
          roomIndex: summary.roomIndex,
          roomName: summary.sickroomName,
          bedCode: bed.bedCode,
          bedName: bed.bedName,
          label: '输液中',
          sortKey: KIND_ORDER.infusion,
        });
      }
    }
  }

  return items.sort((a, b) => {
    if (a.sortKey !== b.sortKey)
      return a.sortKey - b.sortKey;
    if (a.roomIndex !== b.roomIndex)
      return a.roomIndex - b.roomIndex;
    return (a.bedName ?? '').localeCompare(b.bedName ?? '', 'zh-CN');
  });
}
