import type { DataStatus } from './data-status.ts';

/** Missing source data must not imply a confirmed negative finding. */
export function wardField(value: unknown): string {
  if (value === null || value === undefined) return '未提供';
  return String(value).trim() || '未提供';
}

export function wardDataNotice(status?: DataStatus): string {
  if (status === 'loading') return '正在更新，当前内容可能为上次记录';
  if (status === 'error') return '信息暂未更新，请重新获取并核对现场情况';
  if (status === 'stale') return '信息更新延迟，请重新获取后核对';
  if (status === 'warning') return '信息尚不完整，请核对需关注的事项';
  return '';
}
