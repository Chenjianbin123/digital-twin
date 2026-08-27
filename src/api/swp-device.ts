import { apiUrl, postJson } from '@/api/http-client';
import {
  buildSwpDeviceQueryBody,
  SWP_DEVICE_LIST_PATH,
  type DiscoverDoorDevicesOptions,
} from '@/core/swp-device-query';
import type { SwpDevicePageData, SwpDeviceRecord } from '@/types/swp-device';

export type { DiscoverDoorDevicesOptions } from '@/core/swp-device-query';

let doorListCacheKey = '';
let doorListCache: SwpDeviceRecord[] | null = null;

function buildCacheKey(areaId: number): string {
  return String(areaId);
}

export function clearDoorDeviceListCache(): void {
  doorListCacheKey = '';
  doorListCache = null;
}

/**
 * 查询门口机列表（仅 querySwpDeviceInfo，同一会话同参数复用缓存）
 */
export async function fetchDoorDeviceListOnce(
  options: DiscoverDoorDevicesOptions,
): Promise<SwpDeviceRecord[]> {
  const body = buildSwpDeviceQueryBody(options);
  const cacheKey = buildCacheKey(options.areaId);
  if (!options.forceRefresh && doorListCache && doorListCacheKey === cacheKey)
    return doorListCache;

  const response = await postJson<SwpDevicePageData>(
    apiUrl(SWP_DEVICE_LIST_PATH),
    body,
  );

  if (response.code !== 200)
    throw new Error(response.message || '查询门口机设备列表失败');

  const records = response.data?.records ?? [];
  doorListCacheKey = cacheKey;
  doorListCache = records;
  return records;
}

/** 提取可用门口机 SN（去重、过滤禁用项） */
export function extractDoorDeviceCodes(records: SwpDeviceRecord[]): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  const sorted = [...records].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  for (const item of sorted) {
    if (item.isEnable === '0')
      continue;
    const code = item.deviceCode?.trim();
    if (!code || seen.has(code))
      continue;
    seen.add(code);
    codes.push(code);
  }

  return codes;
}

/** querySwpDeviceInfo → 门口机 SN 列表 */
export async function discoverDoorDeviceCodes(
  options: DiscoverDoorDevicesOptions,
): Promise<string[]> {
  const records = await fetchDoorDeviceListOnce(options);
  return extractDoorDeviceCodes(records);
}

export function isSwpDiscoverConfigured(): boolean {
  return true;
}
