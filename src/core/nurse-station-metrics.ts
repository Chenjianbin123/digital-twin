import { buildNurseStationLiveData } from './nurse-station-live-data.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

export type NurseStationStateLevel = 'normal' | 'attention' | 'urgent';

export interface NurseStationMetrics {
  rooms: number;
  totalBeds: number;
  occupied: number;
  empty: number;
  calling: number;
  offlineBeds: number;
  envWarnings: number;
  deviceTotal: number;
  deviceOnline: number;
  deviceHealthRate: number;
  state: {
    level: NurseStationStateLevel;
    label: string;
    message: string;
  };
}

export function buildNurseStationMetrics(
  area: TwinAreaEntity,
  configuredDeviceCount = 0,
  envWarnings = 0,
): NurseStationMetrics {
  const live = buildNurseStationLiveData(area, area.rooms.map((room, roomIndex) => ({
    roomIndex,
    sickroomName: room.sickroomName,
    sickroomCode: room.sickroomCode,
    totalBeds: room.beds.length,
    occupiedBeds: room.beds.filter(bed => bed.isOccupied).length,
    infusingCount: 0,
    offlineCount: 0,
    callingCount: room.beds.filter(bed => bed.isCalling).length,
    envAlertLevel: envWarnings > 0 ? 'warning' : 'normal',
    priority: 'normal',
    accentColor: '#7bdff2',
    statusText: '',
  })), configuredDeviceCount);

  return {
    rooms: live.rooms,
    totalBeds: live.totalBeds,
    occupied: live.occupiedBeds,
    empty: live.emptyBeds,
    calling: live.callingCount,
    offlineBeds: live.offlineBedCount,
    envWarnings: live.envWarningCount,
    deviceTotal: live.deviceTotal,
    deviceOnline: live.deviceOnline,
    deviceHealthRate: live.deviceHealthRate ?? 0,
    state: live.state,
  };
}
