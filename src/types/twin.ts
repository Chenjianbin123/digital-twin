import type {
  BedDevice,
  DoorDeptUser,
  DoorDeviceInfo,
  DoorEnvParams,
  DoorMainStaff,
  DoorSickInfo,
  NursingLabelItem,
  StatusBarInfo,
  StatusCode,
} from './ward';

/** 孪生场景三类型：护士站 → 病房（走廊） → 病房内 */
export type TwinSceneType = 'nurse-station' | 'ward' | 'ward-interior';

/** 病房内子视图：3D 空间 / 2.5D 平面 */
export type WardInteriorView = '3d' | 'plan';

export type CameraPresetId = 'free' | 'door' | 'nurse' | 'top';

/** @internal AreaScene 工作台/走廊阶段（由 TwinSceneType 映射） */
export type AreaViewPhase = 'station' | 'corridor';

/** 护士站、病房 → AreaScene 阶段 */
export function twinSceneToAreaPhase(scene: TwinSceneType): AreaViewPhase {
  return scene === 'nurse-station' ? 'station' : 'corridor';
}

/** @deprecated 请使用 TwinSceneType */
export type ViewMode = 'area' | '3d' | 'plan';

export interface TwinBedEntity {
  bedCode: string;
  bedName: string;
  deviceCode: string;
  position: { x: number; z: number };
  isOccupied: boolean;
  /** 床头屏模板 ID，来自 queryBedDeviceInfo → bedDeviceInfoVo.templateId */
  templateId?: number;
  nursingColor?: string;
  nursingLevel?: string;
  sickInfo?: DoorSickInfo;
  statusBarInfo?: StatusBarInfo;
  nursingLabels?: NursingLabelItem[];
  latestVitals?: {
    temp?: string;
    pulse?: string;
    breath?: string;
    bloodPressure?: string;
    bloodSugar?: string;
    recordTime?: string;
  };
  isOnline: boolean;
  /** 床位呼叫中 */
  isCalling?: boolean;
}

/** 门口机屏幕方向，对齐主项目 DeviceInfo.director */
export type DoorDirector = '0' | '1';

export interface TwinWardEntity {
  sickroomName: string;
  sickroomCode: string;
  sickroomId: string;
  deviceCode: string;
  /** 门口机在线状态，来自真实设备列表或详情接口 */
  isOnline?: boolean;
  /** 门口屏模板 ID，来自 doorDeviceInfo.templateId */
  templateId?: number;
  /** 门口机横竖屏：'0' 横屏，'1' 竖屏（对齐主项目 getCacheInfo('director')） */
  director?: DoorDirector;
  deviceName?: string;
  deviceIp?: string;
  doorStaff?: DoorMainStaff;
  doorDeptUsers?: DoorDeptUser[];
  doorEnvData?: DoorEnvParams;
  beds: TwinBedEntity[];
}

export interface WardBedStats {
  total: number;
  occupied: number;
  empty: number;
}

export function getWardBedStats(ward: TwinWardEntity): WardBedStats {
  const total = ward.beds.length;
  const occupied = ward.beds.filter(b => b.isOccupied).length;
  return { total, occupied, empty: total - occupied };
}

export interface TwinAreaEntity {
  areaName: string;
  areaCode: string;
  deptName: string;
  rooms: TwinWardEntity[];
}

export type BedVisualState = 'empty' | 'occupied' | 'infusing' | 'infused' | 'offline' | 'lowBattery' | 'calling';

export interface BedStatusMeta {
  state: BedVisualState;
  label: string;
  color: string;
  emissive: string;
}

export type HistoryCategory = 'infusion' | 'env' | 'call' | 'device';

export interface StatusHistoryEntry {
  id: string;
  time: string;
  category: HistoryCategory;
  bedCode: string;
  bedName: string;
  label: string;
  roomName: string;
}

/** 床位布局与房间尺寸联动，多人间加大间距避免拥挤 */
const BED_LAYOUTS: Record<number, Array<{ x: number; z: number }>> = {
  1: [{ x: 0, z: -0.5 }],
  2: [{ x: -3.4, z: 0 }, { x: 3.4, z: 0 }],
  3: [{ x: -4.5, z: -0.5 }, { x: 0, z: -0.5 }, { x: 4.5, z: -0.5 }],
  4: [
    { x: -4.8, z: -3 },
    { x: 4.8, z: -3 },
    { x: -4.8, z: 3 },
    { x: 4.8, z: 3 },
  ],
  5: [
    { x: -5, z: -3.5 },
    { x: 5, z: -3.5 },
    { x: -5, z: 0.5 },
    { x: 5, z: 0.5 },
    { x: 0, z: 4 },
  ],
  6: [
    { x: -5.2, z: -4 },
    { x: 5.2, z: -4 },
    { x: -5.2, z: 0 },
    { x: 5.2, z: 0 },
    { x: -5.2, z: 4 },
    { x: 5.2, z: 4 },
  ],
};

const WARD_ROOM_SIZES: Record<number, { w: number; d: number }> = {
  1: { w: 12, d: 10 },
  2: { w: 13, d: 10.8 },
  3: { w: 14.8, d: 11.5 },
  4: { w: 16, d: 12 },
  5: { w: 17, d: 13 },
  6: { w: 18, d: 14 },
};

/** 按床位数返回病房内径，多人间自动放大 */
export function getWardRoomSize(bedCount: number): { w: number; d: number } {
  const count = Math.min(6, Math.max(1, bedCount));
  return WARD_ROOM_SIZES[count] ?? WARD_ROOM_SIZES[6];
}

function getBedPosition(index: number, total: number): { x: number; z: number } {
  const layout = BED_LAYOUTS[total] ?? BED_LAYOUTS[6];
  return layout[index] ?? layout[layout.length - 1] ?? { x: 0, z: 0 };
}

export function mapDoorDeviceToTwinWard(doorData: DoorDeviceInfo): TwinWardEntity {
  const { doorDeviceInfo, bedDeviceList, doorSickInfoList, doorEnvData } = doorData;
  const sickMap = new Map(doorSickInfoList.map(s => [s.bedCode, s]));

  const beds: TwinBedEntity[] = bedDeviceList.map((bed, index) => {
    const sickInfo = sickMap.get(bed.bedCode);
    return {
      bedCode: bed.bedCode,
      bedName: bed.bedName,
      deviceCode: bed.deviceCode,
      position: getBedPosition(index, bedDeviceList.length),
      isOccupied: !!sickInfo,
      nursingColor: sickInfo?.nursingColor,
      nursingLevel: sickInfo?.nursingLevel,
      sickInfo,
      nursingLabels: sickInfo?.nursingLabels,
      statusBarInfo: bed.statusBarInfo,
      isOnline: bed.isOnline === '1',
    };
  });

  return {
    sickroomName: doorDeviceInfo.sickroomName,
    sickroomCode: doorDeviceInfo.sickroomCode,
    sickroomId: doorDeviceInfo.sickroomId,
    deviceCode: doorDeviceInfo.deviceCode,
    isOnline: doorDeviceInfo.isOnline == null || doorDeviceInfo.isOnline === ''
      ? undefined
      : doorDeviceInfo.isOnline === '1',
    templateId: doorDeviceInfo.templateId,
    director: doorDeviceInfo.director,
    deviceName: doorDeviceInfo.deviceName,
    deviceIp: doorDeviceInfo.deviceIp,
    doorStaff: doorData.doorMainDoctorAndNurseVo,
    doorDeptUsers: doorData.doorDeptUserList,
    doorEnvData,
    beds,
  };
}

export function mapDoorListToTwinArea(devices: DoorDeviceInfo[]): TwinAreaEntity {
  const first = devices[0];
  return {
    areaName: first.doorDeviceInfo.areaName,
    areaCode: first.doorDeviceInfo.areaCode,
    deptName: first.doorDeviceInfo.deptName,
    rooms: devices.map(mapDoorDeviceToTwinWard),
  };
}

export type { BedDevice, DoorDeviceInfo, DoorEnvParams, DoorSickInfo, StatusBarInfo, StatusCode };
