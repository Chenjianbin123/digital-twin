import { clearDoorDeviceListCache } from '@/api/swp-device';

/** 刷新/重置时清空 SWP 设备列表缓存 */
export function clearAreaDiscoveryCache(): void {
  clearDoorDeviceListCache();
}
