import { apiUrl, postJson } from '@/api/http-client';
import { getDataSource } from '@/api/door-device';
import { mockCalls, mockAlarms, mockResponses, mockPage } from '@/mock/clinical-records';
import { readSwpRecordPage } from '@/core/swp-page-coverage';
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
  SwpRecordPage,
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
): Promise<SwpRecordPage<T>> {
  const response = await postJson<SwpPageData<T>>(apiUrl(path), body);
  if (response.code !== 200)
    throw new Error(response.message || errorMessage);
  return readSwpRecordPage(response.data);
}

export function fetchActiveSwpCalls(areaId: number, pageNum = 1): Promise<SwpRecordPage<SwpCallRecord>> {
  if (getDataSource() === 'mock') return Promise.resolve(mockPage(mockCalls(areaId), pageNum));
  return querySinglePage<SwpCallRecord>(
    SWP_CALL_LIST_PATH,
    { ...buildActiveSwpEventQuery(areaId), pageNum },
    '查询未处理呼叫记录失败',
  );
}

export function fetchActiveSwpAlarms(areaId: number, pageNum = 1): Promise<SwpRecordPage<SwpAlarmRecord>> {
  if (getDataSource() === 'mock') return Promise.resolve(mockPage(mockAlarms(areaId), pageNum));
  return querySinglePage<SwpAlarmRecord>(
    SWP_ALARM_LIST_PATH,
    { ...buildActiveSwpEventQuery(areaId), pageNum },
    '查询活动输液报警失败',
  );
}

export function fetchSwpResponseTimeliness(
  areaId: number,
  now = new Date(),
): Promise<SwpResponseTimelinessRecord[]> {
  if (getDataSource() === 'mock') return Promise.resolve(mockResponses(areaId));
  return queryPages<SwpResponseTimelinessRecord>(
    SWP_RESPONSE_TIMELINESS_PATH,
    buildSwpResponseQuery(areaId, now),
    '查询呼叫响应时效失败',
  );
}

// Bounded reconciliation: only explicit status 1 may close an occurrence missing from a partial pending page.
export function fetchProcessedSwpCalls(areaId: number, pageNum = 1): Promise<SwpRecordPage<SwpCallRecord>> {
  if (getDataSource() === 'mock') return Promise.resolve(mockPage<SwpCallRecord>([], pageNum));
  return querySinglePage<SwpCallRecord>(SWP_CALL_LIST_PATH,
    { ...buildActiveSwpEventQuery(areaId), eventStatus: '1', pageNum }, '查询已处理呼叫记录失败');
}

export function fetchProcessedSwpAlarms(areaId: number, pageNum = 1): Promise<SwpRecordPage<SwpAlarmRecord>> {
  if (getDataSource() === 'mock') return Promise.resolve(mockPage<SwpAlarmRecord>([], pageNum));
  return querySinglePage<SwpAlarmRecord>(SWP_ALARM_LIST_PATH,
    { ...buildActiveSwpEventQuery(areaId), eventStatus: '1', pageNum }, '查询已处理输液报警失败');
}
