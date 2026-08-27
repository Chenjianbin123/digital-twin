import { apiUrl, postJson } from '@/api/http-client';
import { getDataSource } from '@/api/door-device';
import { MOCK_HOSPITAL_INFO } from '@/mock/hospital-info';
import type { HospitalInfo } from '@/types/hospital';

const HOSPITAL_INFO_PATH = 'device/commonDevice/queryHospHospitalInfo';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 对齐主项目 hosIntro.queryHosIntro({}) */
export async function fetchHospitalInfo(): Promise<HospitalInfo | null> {
  if (getDataSource() === 'mock') {
    await delay(200);
    return structuredClone(MOCK_HOSPITAL_INFO);
  }

  const response = await postJson<HospitalInfo>(apiUrl(HOSPITAL_INFO_PATH), {});
  if (response.code !== 200 || !response.data)
    return null;
  return response.data;
}

