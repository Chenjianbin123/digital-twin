export interface DeploymentEndpoints {
  apiBase: string;
  fileOrigin: string;
}

/** One host contract shared by the browser and Vite's development/preview proxy. */
export function deploymentEndpoints(raw?: string): DeploymentEndpoints {
  const value = raw?.trim() ?? '';
  const invalid = () => new Error('请配置有效的 VITE_DEVICE_HOST（IP 或 HTTP/HTTPS 地址，不含账号、参数或其他路径）');
  if (!value || /[\s\\?#]/.test(value) || value.startsWith('/')) throw invalid();
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `http://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
      || !/^\/(?:swp\/*)?$/.test(url.pathname)) throw invalid();
    url.port = '9700';
    url.pathname = '/swp';
    const apiBase = url.toString();
    url.port = '9704';
    return { apiBase, fileOrigin: url.origin };
  }
  catch { throw invalid(); }
}

export function configuredDeviceHost(env: { VITE_DEVICE_HOST?: string; VITE_API_BASE_URL?: string }): string {
  return env.VITE_DEVICE_HOST?.trim() || env.VITE_API_BASE_URL?.trim() || '';
}

/** A stale server parameter must not redirect resources to another deployment. */
export function deploymentFilePrefix(value: string | undefined, fileOrigin: string): string {
  if (!fileOrigin) return '';
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.origin !== fileOrigin || url.username || url.password || url.search || url.hash) return fileOrigin;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }
  catch { return fileOrigin; }
}
