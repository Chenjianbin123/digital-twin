import type { BedDevice, DoorDeptUser, DoorDeviceInfo, DoorEnvParams, DoorMainStaff, DoorSickInfo } from '@/types/ward';
import type { SwpDeviceRecord } from '@/types/swp-device';

const ENV_UNIT_MAP: Record<string, string> = {
  temp: '℃',
  relativeHumid: '%',
  noiseLevel: 'dB',
};

type DoorInfoInput = Record<string, unknown> | DoorDeviceInfo['doorDeviceInfo'];
type BedDeviceInput = Record<string, unknown> | BedDevice;

interface RawDoorPayload {
  doorDeviceInfo?: DoorInfoInput;
  bedDeviceList?: BedDeviceInput[];
  doorSickInfoList?: DoorSickInfo[];
  doorDeptUserList?: DoorDeptUser[];
  doorMainDoctorAndNurseVo?: DoorMainStaff;
  doorEnvData?: DoorEnvParams;
}

function asString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null)
    return fallback;
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
}

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value).trim();
    if (normalized)
      return normalized;
  }
  return '';
}

/** 兼容不同设备列表接口对床头机 SN 的字段命名。 */
export function resolveBedDeviceCode(raw: BedDeviceInput): string {
  const record = asRecord(raw);
  const device = asRecord(record.device);
  const deviceInfo = asRecord(record.deviceInfo);
  const bedDeviceInfo = asRecord(record.bedDeviceInfoVo);
  return firstNonEmptyString([
    record.deviceCode,
    record.deviceSn,
    record.deviceSN,
    record.sn,
    record.serialNumber,
    record.serialNo,
    record.device_sn,
    record.serial_number,
    device.deviceCode,
    device.deviceSn,
    device.sn,
    device.serialNumber,
    deviceInfo.deviceCode,
    deviceInfo.deviceSn,
    deviceInfo.sn,
    deviceInfo.serialNumber,
    bedDeviceInfo.deviceCode,
    bedDeviceInfo.deviceSn,
    bedDeviceInfo.sn,
    bedDeviceInfo.serialNumber,
  ]);
}

function isValidBedSlot(raw: BedDeviceInput): boolean {
  return !!(asString(raw.bedCode) || asString(raw.bedName));
}

function normalizeBedDevice(raw: BedDeviceInput): BedDevice {
  const deviceCode = resolveBedDeviceCode(raw);

  return {
    id: Number(raw.id ?? 0),
    deviceName: asString(raw.deviceName),
    deviceCode,
    deviceIp: asString(raw.deviceIp),
    deviceTypeId: Number(raw.deviceTypeId ?? 0),
    sickroomName: asString(raw.sickroomName),
    sickroomCode: asString(raw.sickroomCode),
    bedName: asString(raw.bedName),
    bedCode: asString(raw.bedCode),
    bedSort: asString(raw.bedSort, '0'),
    isOnline: asString(raw.isOnline, '0'),
    statusBarInfo: raw.statusBarInfo as BedDevice['statusBarInfo'],
  };
}

export function normalizeDoorDevice(raw: RawDoorPayload): DoorDeviceInfo {
  const info = raw.doorDeviceInfo ?? {};

  const beds = (raw.bedDeviceList ?? [])
    .filter(isValidBedSlot)
    .map(item => normalizeBedDevice(item))
    .sort((a, b) => Number(a.bedSort) - Number(b.bedSort) || a.bedName.localeCompare(b.bedName, 'zh-CN'));

  return {
    doorDeviceInfo: {
      id: Number(info.id ?? 0),
      deviceName: asString(info.deviceName),
      deviceCode: asString(info.deviceCode),
      deviceIp: asString(info.deviceIp),
      deviceTypeCode: asString(info.deviceTypeCode, '201'),
      isOnline: info.isOnline == null ? undefined : asString(info.isOnline),
      deviceSubnetMask: asString(info.deviceSubnetMask),
      deviceGatewayAddress: asString(info.deviceGatewayAddress),
      deptId: asString(info.deptId),
      deptName: asString(info.deptName),
      deptCode: asString(info.deptCode),
      deptNote: asString(info.deptNote),
      areaId: Number(info.areaId ?? 0),
      areaName: asString(info.areaName),
      areaCode: asString(info.areaCode),
      areaNote: asString(info.areaNote),
      sickroomId: asString(info.sickroomId),
      sickroomName: asString(info.sickroomName),
      sickroomCode: asString(info.sickroomCode),
      templateId: Number(info.templateId ?? 0),
      director: info.director === '1' ? '1' : info.director === '0' ? '0' : undefined,
    },
    bedDeviceList: beds,
    doorSickInfoList: raw.doorSickInfoList ?? [],
    doorDeptUserList: raw.doorDeptUserList,
    doorMainDoctorAndNurseVo: raw.doorMainDoctorAndNurseVo,
    doorEnvData: raw.doorEnvData,
  };
}

export function mapEnvRecords(
  records: Array<{ deviceActionCode: string; deviceActionValue: string }>,
): DoorEnvParams {
  const env: DoorEnvParams = {};
  for (const item of records) {
    const key = item.deviceActionCode as keyof DoorEnvParams;
    if (!(key in ENV_UNIT_MAP) && key !== 'airQuality')
      continue;
    const unit = ENV_UNIT_MAP[key] ?? '';
    env[key] = `${item.deviceActionValue}${unit}`;
  }
  return env;
}

/** querySwpDeviceInfo 单条记录 → DoorDeviceInfo（不含床位/患者详情） */
export function mapSwpRecordToDoorDevice(record: SwpDeviceRecord): DoorDeviceInfo {
  const deviceCode = asString(record.deviceCode);
  const sickroomName = asString(record.devicePlace) || asString(record.deviceName);

  return {
    doorDeviceInfo: {
      id: Number(record.id ?? 0),
      deviceName: asString(record.deviceName),
      deviceCode,
      deviceIp: asString(record.deviceIp),
      deviceTypeCode: '201',
      isOnline: record.isOnline == null ? undefined : asString(record.isOnline),
      deviceSubnetMask: asString(record.deviceSubnetMask),
      deviceGatewayAddress: asString(record.deviceGatewayAddress),
      deptId: asString(record.deptId),
      deptName: '',
      deptCode: '',
      deptNote: '',
      areaId: Number(record.areaId ?? 0),
      areaName: '',
      areaCode: '',
      areaNote: '',
      sickroomId: asString(record.sickroomId),
      sickroomName,
      sickroomCode: '',
      templateId: Number(record.templateId ?? 0),
    },
    bedDeviceList: [],
    doorSickInfoList: [],
  };
}

/** 按 sort 去重后的 SWP 记录列表 → DoorDeviceInfo[] */
export function mapSwpRecordsToDoorDevices(records: SwpDeviceRecord[]): DoorDeviceInfo[] {
  const seen = new Set<string>();
  const sorted = [...records].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const devices: DoorDeviceInfo[] = [];

  for (const record of sorted) {
    if (record.isEnable === '0')
      continue;
    const code = asString(record.deviceCode);
    if (!code || seen.has(code))
      continue;
    seen.add(code);
    devices.push(mapSwpRecordToDoorDevice(record));
  }

  return devices;
}
