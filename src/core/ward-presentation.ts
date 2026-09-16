import type { DataStatus } from './data-status.ts';

/** Missing source data must not imply a confirmed negative finding. */
export function wardField(value: unknown): string {
  if (value === null || value === undefined) return '未提供';
  return String(value).trim() || '未提供';
}

export function wardDataNotice(status?: DataStatus): string {
  if (status === 'loading') return '正在同步，当前内容可能为上次数据';
  if (status === 'error') return '同步失败，当前保留上次数据，请重新同步';
  if (status === 'stale') return '数据已过期，请重新同步后核对';
  if (status === 'warning') return '部分数据未完整同步，请核对异常详情';
  return '';
}
