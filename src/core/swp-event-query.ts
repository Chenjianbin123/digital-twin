import type { SwpPageData } from '../types/swp-events.ts';

export const SWP_CALL_LIST_PATH = 'swp/swpCallInfo/querySwpCallInfo';
export const SWP_ALARM_LIST_PATH = 'swp/swpAlarmInfo/querySwpAlarmInfo';
export const SWP_RESPONSE_TIMELINESS_PATH = 'swp/swpCallInfo/queryCallEventResponseTimeliness';

const PAGE_SIZE = 200;
const MAX_PAGE_REQUESTS = 20;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateTime(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

export function buildActiveSwpEventQuery(areaId: number) {
  return {
    areaId,
    eventStatus: '0' as const,
    pageNum: 1,
    pageSize: PAGE_SIZE,
  };
}

export function buildSwpResponseQuery(areaId: number, now = new Date(), lookbackHours = 24) {
  const start = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  return {
    areaId,
    callStartTime: formatLocalDateTime(start),
    callEndTime: formatLocalDateTime(now),
    pageNum: 1,
    pageSize: PAGE_SIZE,
  };
}

export async function collectPagedSwpRecords<T>(
  baseQuery: { pageNum: number; pageSize: number; [key: string]: unknown },
  fetchPage: (query: typeof baseQuery) => Promise<SwpPageData<T>>,
): Promise<T[]> {
  const records: T[] = [];
  const seenPages = new Set<string>();
  let pageNum = baseQuery.pageNum;
  for (let requestCount = 0; requestCount < MAX_PAGE_REQUESTS; requestCount += 1) {
    const page = await fetchPage({ ...baseQuery, pageNum });
    const pageRecords = page?.records ?? [];
    const responsePageNum = Number(page?.current ?? page?.pageNum);
    if (
      requestCount > 0
      && Number.isFinite(responsePageNum)
      && responsePageNum !== pageNum
    ) {
      break;
    }
    const pageSignature = JSON.stringify(pageRecords);
    if (seenPages.has(pageSignature))
      break;
    seenPages.add(pageSignature);
    records.push(...pageRecords);
    const total = Number(page?.total);
    const hasTotal = Number.isFinite(total) && total >= 0;
    if (!pageRecords.length || (hasTotal && records.length >= total))
      break;
    const reportedPageSize = Number(page?.size ?? page?.pageSize);
    const effectivePageSize = Number.isFinite(reportedPageSize) && reportedPageSize > 0
      ? reportedPageSize
      : baseQuery.pageSize;
    if (pageRecords.length < effectivePageSize)
      break;
    pageNum += 1;
  }
  return records;
}
