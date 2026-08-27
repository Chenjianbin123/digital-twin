export interface DeviceCacheInfo {
  /** 病区 ID，querySwpDeviceInfo 筛选用（可选） */
  areaId: string;
  /** 科室 ID（可选） */
  deptId: string;
  /** 完整 API 根路径，如 http://192.168.96.104:9700/swp */
  host: string;
  /** SWP 接口鉴权 token（请求头 token） */
  token: string;
}

export type DeviceCacheField = keyof DeviceCacheInfo;
