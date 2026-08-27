import { apiUrl, postJson } from './http-client.ts';
import { normalizeHospitalAreaRecords } from '../core/hospital-area.ts';
import type {
  HospAreaPageData,
  HospAreaQueryParams,
  HospAreaRawRecord,
  HospAreaRecord,
} from '../types/hospital-area.ts';

const HOSPITAL_AREA_PATH = 'hosp/hospAreaInfo/queryHospAreaInfo';
const PAGE_SIZE = 200;

function queryBody(pageNum: number): HospAreaQueryParams {
  return { areaCode: '', areaName: '', isEnable: '1', pageNum, pageSize: PAGE_SIZE, sqlFilter: '' };
}

export async function fetchHospitalAreas(): Promise<HospAreaRecord[]> {
  const rawRecords: HospAreaRawRecord[] = [];
  let pageNum = 1;
  let pages = 1;
  do {
    const response = await postJson<HospAreaPageData>(apiUrl(HOSPITAL_AREA_PATH), queryBody(pageNum));
    if (response.code !== 200)
      throw new Error(response.message || '查询病区信息失败');
    rawRecords.push(...(response.data?.records ?? []));
    pages = Math.max(1, Number(response.data?.pages ?? 1));
    pageNum += 1;
  } while (pageNum <= pages);

  return normalizeHospitalAreaRecords(rawRecords);
}
