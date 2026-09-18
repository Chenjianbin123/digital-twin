export interface HospAreaRecord {
  id: number;
  areaName: string;
  areaCode: string;
  areaOutCode: string;
  isEnable: string;
  /** Optional occupancy / capacity stats when the source provides them. */
  roomCount?: number;
  bedCount?: number;
  occupiedCount?: number;
  /** Total people in the ward; defaults to occupiedCount when only one headcount is available. */
  peopleCount?: number;
  deviceCount?: number;
}

export interface HospAreaRawRecord {
  id?: number | string;
  areaName?: string;
  areaCode?: string;
  areaOutCode?: string;
  isEnable?: string;
  roomCount?: number | string;
  roomNum?: number | string;
  bedCount?: number | string;
  bedNum?: number | string;
  occupiedCount?: number | string;
  sickNum?: number | string;
  patientNum?: number | string;
  patientCount?: number | string;
  peopleCount?: number | string;
  peopleNum?: number | string;
  deviceCount?: number | string;
  deviceNum?: number | string;
}

export interface HospAreaPageData {
  records?: HospAreaRawRecord[];
  total?: number;
  pages?: number;
  current?: number;
  size?: number;
  pageNum?: number;
  pageSize?: number;
}

export interface HospAreaQueryParams {
  areaCode: string;
  areaName: string;
  isEnable: '1';
  pageNum: number;
  pageSize: number;
  sqlFilter: string;
}
