export type DataSource = 'mock' | 'remote' | 'database';

export function resolveDataSource(_value?: string): DataSource {
  // 此分支固定离线演示，现场环境变量也不能重新启用后台。
  return 'mock';
}

export function assertRemoteRequestsAllowed(): void {
  throw new Error('本地模拟分支已禁用后台接口请求');
}
