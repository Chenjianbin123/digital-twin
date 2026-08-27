/** swp/swpDeviceInfo/querySwpDeviceInfo 入参（对齐接口文档） */
export interface SwpDeviceQueryParams {
  areaId: number;
  deptId: number | string;
  deviceIp: string;
  deviceName: string;
  deviceTypeId: number;
  online: string;
  pageNum: number;
  pageSize: number;
  sipNo: string;
}

/** 设备列表单条记录 */
export interface SwpDeviceRecord {
  id: number;
  deviceName: string;
  deviceCode: string;
  devicePlace?: string;
  deviceTypeId?: number;
  templateId?: number;
  areaId?: number;
  deptId?: number;
  sickroomId?: number;
  sickroomType?: string;
  deviceIp?: string;
  deviceGatewayAddress?: string;
  deviceSubnetMask?: string;
  isOnline?: string;
  isEnable?: string;
  sort?: number;
}

export interface SwpDevicePageData {
  records: SwpDeviceRecord[];
  total?: number;
  pageNum?: number;
  pageSize?: number;
  current?: number;
  size?: number;
  pages?: number;
}
