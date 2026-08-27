import { apiUrl, postJson } from '@/api/http-client';
import {
  SWP_ALARM_LIST_PATH,
  SWP_CALL_LIST_PATH,
  SWP_RESPONSE_TIMELINESS_PATH,
  buildActiveSwpEventQuery,
  buildSwpResponseQuery,
  collectPagedSwpRecords,
} from '@/core/swp-event-query';
import type {
  SwpAlarmRecord,
  SwpCallRecord,
  SwpPageData,
  SwpResponseTimelinessRecord,
} from '@/types/swp-events';

async function queryPages<T>(
  path: string,
  body: { pageNum: number; pageSize: number; [key: string]: unknown },
  errorMessage: string,
): Promise<T[]> {
  return collectPagedSwpRecords(body, async (query) => {
    const response = await postJson<SwpPageData<T>>(apiUrl(path), query);
    if (response.code !== 200)
      throw new Error(response.message || errorMessage);
    return response.data ?? {};
  });
}

async function querySinglePage<T>(
  path: string,
  body: { pageNum: number; pageSize: number; [key: string]: unknown },
  errorMessage: string,
): Promise<T[]> {
  const response = await postJson<SwpPageData<T>>(apiUrl(path), body);
  if (response.code !== 200)
    throw new Error(response.message || errorMessage);
  return response.data?.records ?? [];
}

export function fetchActiveSwpCalls(areaId: number): Promise<SwpCallRecord[]> {
  return querySinglePage<SwpCallRecord>(
    SWP_CALL_LIST_PATH,
    buildActiveSwpEventQuery(areaId),
    '查询活动呼叫事件失败',
  );
}

export function fetchActiveSwpAlarms(areaId: number): Promise<SwpAlarmRecord[]> {
  return querySinglePage<SwpAlarmRecord>(
    SWP_ALARM_LIST_PATH,
    buildActiveSwpEventQuery(areaId),
    '查询活动输液报警失败',
  );
}

export function fetchSwpResponseTimeliness(
  areaId: number,
  now = new Date(),
): Promise<SwpResponseTimelinessRecord[]> {
  return queryPages<SwpResponseTimelinessRecord>(
    SWP_RESPONSE_TIMELINESS_PATH,
    buildSwpResponseQuery(areaId, now),
    '查询呼叫响应时效失败',
  );
}
