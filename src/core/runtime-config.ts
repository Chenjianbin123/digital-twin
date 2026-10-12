import { deploymentEndpoints } from './deployment-endpoints.ts';

export interface RuntimeConfig {
  deviceHost: string;
}

let config: Readonly<RuntimeConfig> | null = null;
export class RuntimeConfigError extends Error {}

export function parseRuntimeConfig(value: unknown): Readonly<RuntimeConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !('deviceHost' in value) || typeof value.deviceHost !== 'string') {
    throw new RuntimeConfigError('config.json 格式错误，请填写 deviceHost 后端地址。');
  }
  try { deploymentEndpoints(value.deviceHost); }
  catch { throw new RuntimeConfigError('config.json 的 deviceHost 无效，请填写后端 IP 或 HTTP/HTTPS 地址，不含账号、参数或其他路径。'); }
  return Object.freeze({ deviceHost: value.deviceHost.trim() });
}

export async function loadRuntimeConfig(url: string, fetcher: typeof fetch = fetch): Promise<Readonly<RuntimeConfig>> {
  config = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    let response: Response;
    try {
      response = await fetcher(url, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    }
    catch { throw new RuntimeConfigError('无法读取 config.json，请检查部署文件和网络后刷新页面。'); }
    if (!response.ok) throw new RuntimeConfigError('无法读取 config.json，请确认文件已部署且允许访问。');
    let value: unknown;
    try { value = await response.json(); }
    catch { throw new RuntimeConfigError('config.json 不是有效的 JSON，请检查文件内容后刷新页面。'); }
    config = parseRuntimeConfig(value);
    return config;
  }
  finally { clearTimeout(timer); }
}

export function getRuntimeDeviceHost(): string {
  return config?.deviceHost ?? '';
}

/** 不同医院的本地病区选择、关注记录和提醒回执必须分开保存。 */
export function runtimeStorageKey(key: string): string {
  return config ? `${key}:${deploymentEndpoints(config.deviceHost).apiBase}` : key;
}
