export interface HospAreaRecord {
  id: number;
  areaName: string;
  areaCode: string;
  areaOutCode: string;
  isEnable: string;
}

export interface HospAreaRawRecord {
  id?: number | string;
  areaName?: string;
  areaCode?: string;
  areaOutCode?: string;
  isEnable?: string;
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
