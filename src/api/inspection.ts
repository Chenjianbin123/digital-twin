import { apiUrl, postJson } from '@/api/http-client';
import { getDataSource } from '@/api/door-device';
import { mockInspections, mockPage } from '@/mock/clinical-records';
import { readSwpRecordPage } from '@/core/swp-page-coverage';
import type { SwpInspectionRecord } from '@/types/inspection';
import type { SwpPageData, SwpRecordPage } from '@/types/swp-events';

export const SWP_INSPECTION_LIST_PATH =
  'swp/swpSwipeInspectionRecord/querySwpSwipeInspectionRecord';

export async function fetchSwpInspectionRecords(
  areaId: number,
): Promise<SwpRecordPage<SwpInspectionRecord>> {
  if (getDataSource() === 'mock') return mockPage(mockInspections(areaId));
  const response = await postJson<SwpPageData<SwpInspectionRecord>>(
    apiUrl(SWP_INSPECTION_LIST_PATH),
    {
      areaId,
      pageNum: 1,
      pageSize: 200,
    },
  );
  if (response.code !== 200)
    throw new Error(response.message || '查询巡视记录失败');
  return readSwpRecordPage(response.data);
}

