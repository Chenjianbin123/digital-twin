/**
 * 开发环境通过 .env 配置地址，生产环境通过启动时加载的 config.json 配置地址。
 */
import type { DeviceCacheInfo } from '@/utils/device-cache.types';
import { getSessionToken } from '@/core/auth-session';
import { configuredDeviceHost, deploymentEndpoints } from '@/core/deployment-endpoints';
import { getRuntimeDeviceHost } from '@/core/runtime-config';

export type { DeviceCacheInfo, DeviceCacheField } from '@/utils/device-cache.types';

/** SWP 平台门口机 deviceTypeId（固定值，不走 .env） */
export const SWP_DOOR_DEVICE_TYPE_ID = 4;

let cache: DeviceCacheInfo | null = null;

/** 对齐主项目：Android host + :9700/swp（强制 9700，避免误用静态站 8093） */
export function normalizeDeviceHost(raw?: string): string {
  try { return deploymentEndpoints(raw).apiBase; }
  catch { return ''; }
}

function readEnvDeviceInfo(): DeviceCacheInfo {
  const areaId = import.meta.env.VITE_AREA_ID?.trim() || '';
  const deptId = import.meta.env.VITE_DEPT_ID?.trim() || '';
  const rawHost = import.meta.env.DEV ? configuredDeviceHost(import.meta.env) : getRuntimeDeviceHost();
  const token = import.meta.env.VITE_API_TOKEN?.trim() || '';

  return {
    areaId,
    deptId,
    host: normalizeDeviceHost(rawHost),
    token,
  };
}

function ensureCache(): DeviceCacheInfo {
  if (!cache)
    cache = readEnvDeviceInfo();
  return cache;
}

/** 对齐主项目 getCacheInfo(type) */
export function getCacheInfo<T extends keyof DeviceCacheInfo>(field: T): DeviceCacheInfo[T] {
  return ensureCache()[field];
}

getCacheInfo.init = () => {
  cache = readEnvDeviceInfo();
};

export function getAreaId(): string {
  return getCacheInfo('areaId');
}

export function getDeptId(): string {
  return getCacheInfo('deptId');
}

export function getDeviceHost(): string {
  return getCacheInfo('host');
}

export function getApiToken(): string {
  return getSessionToken() || getCacheInfo('token');
}

/** 开发环境走 Vite 代理 /swp；生产环境必须打到 :9700，禁止相对 /swp（会落到静态 Nginx 如 :8093 → 405） */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV)
    return '/swp';

  return deploymentEndpoints(getDeviceHost()).apiBase;
}

export function isDeviceRuntimeConfigured(): boolean {
  if (!getApiToken())
    return false;

  if (import.meta.env.DEV)
    return true;

  return !!getDeviceHost();
}

export function assertDeviceRuntimeConfigured(): void {
  if (!getApiToken())
    throw new Error('请配置 VITE_API_TOKEN（SWP 接口鉴权 token）');

  if (!import.meta.env.DEV && !getDeviceHost())
    throw new Error('请配置 config.json 的 deviceHost（后端地址）');
}

/** 从 host 推导文件资源端口（9704），供 initFileUrlPrefix 失败时兜底 */
export function deriveFileHostFromDeviceHost(): string {
  const host = getDeviceHost() || (!import.meta.env.DEV ? getApiBaseUrl() : '');
  if (!host)
    return '';

  try {
    return deploymentEndpoints(host).fileOrigin;
  }
  catch {
    return '';
  }
}
