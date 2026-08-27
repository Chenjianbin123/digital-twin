/**
 * Web 端通过 .env 配置 Host / Token / 病区 ID
 */
import type { DeviceCacheInfo } from '@/utils/device-cache.types';
import { getSessionToken } from '@/core/auth-session';

export type { DeviceCacheInfo, DeviceCacheField } from '@/utils/device-cache.types';

/** SWP 平台门口机 deviceTypeId（固定值，不走 .env） */
export const SWP_DOOR_DEVICE_TYPE_ID = 4;

let cache: DeviceCacheInfo | null = null;

/** 对齐主项目：Android host + :9700/swp */
export function normalizeDeviceHost(raw?: string): string {
  const value = raw?.trim();
  if (!value)
    return '';

  let host = value.replace(/\/+$/, '');

  if (/^\/swp$/i.test(host))
    return host;

  if (!/^https?:\/\//i.test(host))
    host = `http://${host}`;

  if (/\/swp$/i.test(host))
    return host;

  if (!/:9700\b/.test(host))
    host = `${host}:9700`;

  return `${host}/swp`;
}

function readEnvDeviceInfo(): DeviceCacheInfo {
  const areaId = import.meta.env.VITE_AREA_ID?.trim() || '';
  const deptId = import.meta.env.VITE_DEPT_ID?.trim() || '';
  const rawHost = import.meta.env.VITE_DEVICE_HOST?.trim()
    || import.meta.env.VITE_API_BASE_URL?.trim()
    || '';
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

/** 开发环境走 Vite 代理 /swp，生产环境用完整 host */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV)
    return '/swp';

  const host = getDeviceHost();
  return host || '/swp';
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
    throw new Error('请配置 VITE_DEVICE_HOST（后端地址）');
}

/** 从 host 推导文件资源端口（9704），供 initFileUrlPrefix 失败时兜底 */
export function deriveFileHostFromDeviceHost(): string {
  const host = getDeviceHost();
  if (!host)
    return '';

  try {
    const url = new URL(host.replace(/\/swp\/?$/i, ''));
    url.port = '9704';
    return url.origin;
  }
  catch {
    return '';
  }
}
