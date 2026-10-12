export type ApiFailureKind = 'gateway' | 'timeout' | 'network' | 'auth' | 'permission' | 'business' | 'invalid-response' | 'http' | 'unknown';
export const API_FAILURE_INFO: Record<ApiFailureKind, { title: string; advice: string; action: 'retry' | 'login' | 'check' }> = {
  gateway: { title: '网关或上游服务暂不可用', advice: '请稍后重试；持续失败请联系运维检查网关与后端服务。', action: 'retry' },
  timeout: { title: '请求超时', advice: '请检查网络后重试；已有数据不代表当前状态。', action: 'retry' },
  network: { title: '网络连接失败', advice: '请检查网络、代理或服务连接后重试。', action: 'retry' },
  auth: { title: '身份验证未通过或登录已失效', advice: '请重新登录；若正在登录，请核对账号和密码。', action: 'login' },
  permission: { title: '访问受限或登录已失效', advice: '请重新登录；仍无法访问时联系管理员核对权限。', action: 'login' },
  business: { title: '业务校验未通过', advice: '请核对输入和业务权限；持续失败请提供诊断记录给管理员。', action: 'check' },
  'invalid-response': { title: '服务返回格式异常', advice: '请稍后重试；持续失败请联系运维检查接口响应。', action: 'retry' },
  http: { title: '服务请求失败', advice: '请稍后重试；持续失败请联系管理员核对接口配置。', action: 'retry' },
  unknown: { title: '请求未完成', advice: '请稍后重试；持续失败请联系管理员。', action: 'retry' },
};

export function httpFailureKind(status: number): ApiFailureKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  return [502, 503, 504].includes(status) ? 'gateway' : 'http';
}

export class ApiError extends Error {
  kind: ApiFailureKind;
  status?: number;
  businessCode?: number;

  constructor(kind: ApiFailureKind, status?: number, businessCode?: number) {
    const info = API_FAILURE_INFO[kind];
    super(`${info.title}${status ? `（HTTP ${status}）` : businessCode != null ? `（业务码 ${businessCode}）` : ''}。${info.advice}`);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.businessCode = businessCode;
  }
}

export function normalizeApiFailure(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new ApiError('timeout');
  if (error instanceof TypeError) return new ApiError('network');
  return new ApiError('unknown');
}
