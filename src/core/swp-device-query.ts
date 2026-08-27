import type { SwpDeviceQueryParams } from '../types/swp-device.ts';

export const DOOR_LIST_PAGE_SIZE = 100;

/** 与开发环境 /swp 基址拼接后请求 /swp/swp/swpDeviceInfo/querySwpDeviceInfo。 */
export const SWP_DEVICE_LIST_PATH = 'swp/swpDeviceInfo/querySwpDeviceInfo';

export interface DiscoverDoorDevicesOptions {
  areaId: number;
  forceRefresh?: boolean;
}

export function buildSwpDeviceQueryBody(
  options: DiscoverDoorDevicesOptions,
): SwpDeviceQueryParams {
  const areaId = Number(options.areaId);
  if (!Number.isFinite(areaId) || areaId <= 0)
    throw new Error('请选择有效病区后再查询设备');

  return {
    areaId,
    deptId: '',
    deviceIp: '',
    deviceName: '',
    deviceTypeId: 4,
    online: '',
    pageNum: 1,
    pageSize: DOOR_LIST_PAGE_SIZE,
    sipNo: '',
  };
}
