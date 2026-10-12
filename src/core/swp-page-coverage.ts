import type { SwpPageData, SwpPageCoverage, SwpRecordPage } from '../types/swp-events.ts';

function count(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

// A successful HTTP request is not evidence that the whole matching set was returned.
export function readSwpRecordPage<T>(page: SwpPageData<T> | undefined): SwpRecordPage<T> {
  if (!page || !Array.isArray(page.records)) throw new Error('接口未返回有效记录列表');
  const total = count(page.total);
  const current = count(page.current ?? page.pageNum);
  const size = count(page.size ?? page.pageSize);
  const pages = count(page.pages);
  const received = page.records.length;
  return { records: page.records, coverage: {
    received, total, current, size, pages,
    complete: current === 1 && total !== null && total === received
      && (pages === null || pages <= 1) && (size === null || received <= size),
  } };
}

export function pageCoverageLabel(label: string, coverage: SwpPageCoverage): string {
  return `${label}：本次获取 ${coverage.received} / ${coverage.total ?? '总数未知'} 条${coverage.complete ? '（完整）' : '（未确认完整）'}`;
}
