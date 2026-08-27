export type SwpIdentifier = string | number;

export interface SwpPageData<T> {
  records?: T[];
  total?: number;
  pageNum?: number;
  pageSize?: number;
  current?: number;
  size?: number;
}

interface SwpEventLocationFields {
  areaId?: SwpIdentifier;
  deptId?: SwpIdentifier;
  sickroomId?: SwpIdentifier;
  sickroomCode?: SwpIdentifier;
  bedCode?: SwpIdentifier;
  deviceCode?: SwpIdentifier;
}

export interface SwpCallRecord extends SwpEventLocationFields {
  id?: SwpIdentifier;
  eventId?: SwpIdentifier;
  callId?: SwpIdentifier;
  areaCode?: string;
  deptCode?: string;
  callFrom?: string;
  callFromName?: string;
  callTo?: string;
  callToName?: string;
  callStartTime?: string;
  callEndTime?: string;
  talkStartTime?: string;
  callMessage?: string;
  callModeCode?: SwpIdentifier;
  callModeName?: string;
  mediaPath?: string;
  remark?: string;
  eventStatus?: SwpIdentifier;
}

export interface SwpAlarmRecord extends SwpEventLocationFields {
  id?: SwpIdentifier;
  eventId?: SwpIdentifier;
  alarmId?: SwpIdentifier;
  alarmType?: SwpIdentifier;
  deviceType?: string;
  alarmStartTime?: string;
  alarmProcessTime?: string;
  eventStatus?: SwpIdentifier;
}

export interface SwpArrivalRecord {
  timeOfArrival?: string;
  efficiencyOfResponse?: string | number;
  durationOfStay?: string | number;
  personnelOnArrival?: string;
}

export interface SwpResponseTimelinessRecord {
  id?: SwpIdentifier;
  areaId?: SwpIdentifier;
  sickroomId?: SwpIdentifier;
  callFromName?: string;
  callToName?: string;
  callStartTime?: string;
  callEndTime?: string;
  callModeName?: string;
  personnelOnArrivals?: string;
  swpUwbTimeOfArrivalVoList?: SwpArrivalRecord[];
}

export interface SwpEventLocation {
  roomIndex: number;
  roomCode: string;
  roomName: string;
  bedCode?: string;
  bedName?: string;
  patientName?: string;
}

export type SwpEventLocationSource =
  | 'sickroom-id'
  | 'sickroom-code'
  | 'bed-code'
  | 'device-code'
  | 'call-from-code';

export type SwpEventSource = 'swp-call' | 'swp-alarm';
export type SwpEventLocationStatus = 'matched' | 'missing-identifiers' | 'unmatched-identifiers';

export interface NormalizedSwpEvent {
  id: string;
  source: SwpEventSource;
  areaId: number;
  taskType: 'call' | 'infusion';
  severity: 'critical' | 'high';
  startedAt?: string;
  timestampMs: number;
  title: string;
  description: string;
  location: SwpEventLocation | null;
  locationStatus: SwpEventLocationStatus;
  locationSource?: SwpEventLocationSource;
  locationLabel: string;
}

export interface SwpResponseMetrics {
  callCount: number;
  arrivedCallCount: number;
  unattendedCallCount: number;
  arrivalCount: number;
  averageResponseSeconds: number | null;
  latestCallAt: string | null;
}

export type SwpEventSyncPhase = 'idle' | 'loading' | 'ready' | 'partial' | 'error';

export interface SwpEventSyncState {
  phase: SwpEventSyncPhase;
  lastSyncedAt: string | null;
  error: string | null;
  warning: string | null;
}
