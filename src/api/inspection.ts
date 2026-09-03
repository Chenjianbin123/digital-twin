import { apiUrl, postJson } from '@/api/http-client';
import type { SwpInspectionRecord } from '@/types/inspection';
import type { SwpPageData } from '@/types/swp-events';

export const SWP_INSPECTION_LIST_PATH =
  'swp/swpSwipeInspectionRecord/querySwpSwipeInspectionRecord';

export async function fetchSwpInspectionRecords(
  areaId: number,
): Promise<SwpInspectionRecord[]> {
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
  return response.data?.records ?? [];
}

