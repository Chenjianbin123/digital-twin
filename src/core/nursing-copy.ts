import type { DataStatus } from './data-status.ts';
import type { ApiFailureKind } from './api-failure.ts';

export const NURSING_STATUS_LABELS: Record<DataStatus, string> = {
  ready: '已更新', loading: '更新中', warning: '信息不完整', stale: '更新延迟', error: '暂未更新',
};

// Keep clinical uncertainty visible without exposing transport errors to routine users.
export function nursingInformationNotice(status: DataStatus, updatedAt?: string | null): string {
  const hasPrevious = Boolean(updatedAt && Number.isFinite(Date.parse(updatedAt)));
  if (status === 'ready') return '';
  if (status === 'warning') return '目前仅有部分记录，请核对现场情况。';
  if (status === 'loading') return hasPrevious ? '正在更新，暂显示上次记录。' : '正在获取信息，请稍候。';
  return hasPrevious ? '信息暂未更新，当前显示上次记录，请核对现场情况。' : '暂未获取信息，请稍后重试并核对现场情况。';
}

export const NURSING_LOGIN_FAILURES: Record<ApiFailureKind, string> = {
  gateway: '登录服务暂不可用，请稍后重试；持续无法登录请联系管理员。',
  timeout: '登录等待时间较长，请检查网络后重试。',
  network: '连接未成功，请检查网络后重试。',
  auth: '登录验证未通过，请核对账号和密码后重新登录。',
  permission: '暂时无法进入，请重新登录；仍无法进入时联系管理员。',
  business: '暂时无法完成登录，请核对填写内容；仍无法登录时联系管理员。',
  'invalid-response': '登录服务暂不可用，请稍后重试；持续无法登录请联系管理员。',
  http: '登录暂未完成，请稍后重试；持续无法登录请联系管理员。',
  unknown: '登录暂未完成，请稍后重试。',
};
