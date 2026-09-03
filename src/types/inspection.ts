import type { SwpEventSyncState, SwpIdentifier } from './swp-events';

export interface SwpInspectionRecord {
  id?: SwpIdentifier;
  areaId?: SwpIdentifier;
  deptId?: SwpIdentifier;
  sickroomId?: SwpIdentifier;
  sickroomCode?: SwpIdentifier;
  sickroomName?: string;
  bedCode?: SwpIdentifier;
  bedName?: string;
  sickName?: string;
  sickNursingLevel?: string;
  nursingLevel?: string;
  carNo?: string;
  doorUserRealname?: string;
  swipeState?: string;
  swipeTime?: string;
  swipeDate?: string;
  intervalSwipeDuration?: string | number;
  swipeInterval?: string | number;
  lastSwipeTime?: string;
  lastDoorUserRealname?: string;
  lastSwipeUser?: string;
  createTime?: string;
}

export type InspectionState = 'normal' | 'due' | 'overdue' | 'unknown';
export type InspectionRoomState = InspectionState | 'no-record';

export interface NormalizedInspectionRecord {
  id: string;
  roomIndex: number;
  roomCode: string;
  roomName: string;
  bedCode?: string;
  bedName?: string;
  patientName?: string;
  nursingLevel?: string;
  nurseName?: string;
  state: InspectionState;
  stateLabel: string;
  occurredAt: string;
  timestampMs: number;
  intervalLabel?: string;
  previousOccurredAt?: string;
  previousNurseName?: string;
}

export interface InspectionRoomSummary {
  roomIndex: number;
  roomCode: string;
  roomName: string;
  state: InspectionRoomState;
  stateLabel: string;
  latestAt: string | null;
  latestNurseName: string | null;
  overdueCount: number;
  dueCount: number;
  normalCount: number;
  records: NormalizedInspectionRecord[];
}

export type InspectionSyncState = SwpEventSyncState;
