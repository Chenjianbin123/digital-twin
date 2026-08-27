import { apiUrl, postJson } from '@/api/http-client';

import { mapEnvRecords, mapSwpRecordsToDoorDevices, normalizeDoorDevice } from '@/api/normalize-door';

import { resolveDataSource, type DataSource } from '@/core/data-source';

import { preloadDoorTemplates } from '@/core/door-template-preload';

import { loadTemplateInfo } from '@/core/template/template-cache';

import { fetchDoorDeviceListOnce, isSwpDiscoverConfigured } from '@/api/swp-device';

import { MOCK_DOOR_DEVICE_LIST } from '@/mock/door-device-list';

import { mapDoorListToTwinArea } from '@/types/twin';

import type { TwinAreaEntity } from '@/types/twin';

import type { ApiResponse, DoorDeviceInfo } from '@/types/ward';

import { assertDeviceRuntimeConfigured, isDeviceRuntimeConfigured } from '@/utils/device-cache';

export type { DataSource } from '@/core/data-source';

const MOCK_DELAY = 400;

const ENV_INFO_PATH = 'iot/app/deviceIotControl/queryRecentEnvRecordById';

const DOOR_INFO_PATH = 'device/doorDevice/queryBaseDeviceInfo';

/** 门口机设备类型码（展示校验用） */
const DOOR_DEVICE_TYPE = '201';

export type DoorCodeSource = 'discover';

export interface FetchDoorDevicesResult {
  devices: DoorDeviceInfo[];
  codes: string[];
  codeSource: DoorCodeSource;
  warnings: string[];
}

export interface FetchDoorDeviceListOptions {
  areaId?: number;
  refreshDeviceList?: boolean;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getDataSource(): DataSource {
  return resolveDataSource(import.meta.env.VITE_DATA_SOURCE);
}

async function fetchMockDoorDeviceList(): Promise<ApiResponse<DoorDeviceInfo[]>> {
  await delay(MOCK_DELAY);
  return structuredClone(MOCK_DOOR_DEVICE_LIST);
}

export async function fetchDoorEnvData(sickroomId: string | number): Promise<DoorDeviceInfo['doorEnvData']> {
  const response = await postJson<Array<{ deviceActionCode: string; deviceActionValue: string }>>(
    apiUrl(ENV_INFO_PATH),
    { sickroomId: Number(sickroomId) },
  );

  if (response.code !== 200 || !response.data?.length)
    return undefined;

  return mapEnvRecords(response.data);
}

async function fetchDoorDeviceInfo(deviceCode: string): Promise<DoorDeviceInfo> {
  const response = await postJson<DoorDeviceInfo>(
    apiUrl(DOOR_INFO_PATH),
    {
      deviceCode,
      apkSystemType: import.meta.env.VITE_APK_SYSTEM_TYPE?.trim() || '2',
    },
  );

  if (response.code !== 200 || !response.data?.doorDeviceInfo)
    throw new Error(response.message || `门口机 ${deviceCode} 基础信息为空`);

  return normalizeDoorDevice(response.data);
}

function sortDoorDevices(devices: DoorDeviceInfo[]): DoorDeviceInfo[] {
  return [...devices].sort((a, b) => {
    const nameA = a.doorDeviceInfo.sickroomName || a.doorDeviceInfo.deviceName;
    const nameB = b.doorDeviceInfo.sickroomName || b.doorDeviceInfo.deviceName;
    return nameA.localeCompare(nameB, 'zh-CN', { numeric: true });
  });
}

async function fetchRemoteDoorDeviceList(
  areaId: number,
  refreshDeviceList = false,
): Promise<FetchDoorDevicesResult> {
  assertDeviceRuntimeConfigured();

  if (!isDeviceRuntimeConfigured() || !isSwpDiscoverConfigured())
    throw new Error('请配置 VITE_DEVICE_HOST 与 VITE_API_TOKEN');

  try {
    const records = await fetchDoorDeviceListOnce({ areaId, forceRefresh: refreshDeviceList });
    const discoveredDevices = sortDoorDevices(mapSwpRecordsToDoorDevices(records));

    if (!discoveredDevices.length)
      throw new Error('querySwpDeviceInfo 未返回任何可用门口机');

    lastResolvedDoorCodes = discoveredDevices.map(d => d.doorDeviceInfo.deviceCode);
    const settled = await Promise.allSettled(
      lastResolvedDoorCodes.map(code => fetchDoorDeviceInfo(code)),
    );
    const detailDevices = settled
      .map((item, index) => {
        if (item.status !== 'fulfilled')
          return null;
        const discoveredOnline = discoveredDevices[index]?.doorDeviceInfo.isOnline;
        if (item.value.doorDeviceInfo.isOnline == null)
          item.value.doorDeviceInfo.isOnline = discoveredOnline;
        // queryBaseDeviceInfo 在部分环境不返回 templateId，
        // 此时沿用 querySwpDeviceInfo 列表中的模板 ID，避免模板预加载被跳过。
        if (!item.value.doorDeviceInfo.templateId) {
          const discoveredTemplateId = discoveredDevices[index]?.doorDeviceInfo.templateId;
          if (discoveredTemplateId)
            item.value.doorDeviceInfo.templateId = discoveredTemplateId;
        }
        return item.value;
      })
      .filter((item): item is DoorDeviceInfo => item !== null);

    if (!detailDevices.length) {
      const firstError = settled.find((item): item is PromiseRejectedResult => item.status === 'rejected');
      const reason = firstError?.reason instanceof Error ? firstError.reason.message : '';
      throw new Error(reason || 'queryBaseDeviceInfo 未返回任何可用门口机详情');
    }

    const warnings = settled
      .map((item, index) => {
        if (item.status === 'fulfilled')
          return '';
        const code = lastResolvedDoorCodes[index] ?? '未知设备';
        const reason = item.reason instanceof Error ? item.reason.message : '查询失败';
        return `${code} 门口机详情加载失败：${reason}`;
      })
      .filter(Boolean);

    const sortedDetails = sortDoorDevices(detailDevices);
    const templateResult = await preloadDoorTemplates(sortedDetails, loadTemplateInfo);
    warnings.push(...templateResult.warnings);
    return {
      devices: sortedDetails,
      codes: [...lastResolvedDoorCodes],
      codeSource: 'discover',
      warnings,
    };
  }
  catch (e) {
    const message = e instanceof Error ? e.message : '查询门口机列表失败';
    if (/failed to fetch|networkerror|load failed/i.test(message))
      throw new Error(`${message}。请检查 VITE_DEVICE_HOST 与网络`);
    throw new Error(message);
  }
}

export async function fetchDoorDeviceList(
  options: FetchDoorDeviceListOptions = {},
): Promise<FetchDoorDevicesResult> {
  if (getDataSource() === 'remote') {
    const areaId = Number(options.areaId ?? 0);
    if (!Number.isFinite(areaId) || areaId <= 0)
      throw new Error('请选择病区后再加载病房数据');
    return fetchRemoteDoorDeviceList(areaId, options.refreshDeviceList);
  }

  const response = await fetchMockDoorDeviceList();
  if (response.code !== 200)
    throw new Error(response.message || '获取门口机数据失败');

  return {
    devices: response.data,
    codes: response.data.map(d => d.doorDeviceInfo.deviceCode),
    codeSource: 'discover',
    warnings: [],
  };
}

export async function fetchTwinAreaData(): Promise<TwinAreaEntity> {
  const { devices } = await fetchDoorDeviceList();
  if (!devices.length)
    throw new Error('未获取到任何病房数据');
  return mapDoorListToTwinArea(devices);
}

export function getConfiguredDeviceCodes(): string[] {
  return lastResolvedDoorCodes;
}

/** 供 UI 展示已发现的门口机数量 */
export function getLastResolvedDoorCodes(): string[] {
  return lastResolvedDoorCodes;
}

let lastResolvedDoorCodes: string[] = [];

/** 校验是否为门口机 SN（201） */
export function validateDoorDeviceCodes(devices: DoorDeviceInfo[]): string[] {
  const warnings: string[] = [];
  for (const device of devices) {
    const { deviceCode, deviceTypeCode, sickroomName } = device.doorDeviceInfo;
    if (deviceTypeCode && deviceTypeCode !== DOOR_DEVICE_TYPE) {
      warnings.push(
        `${deviceCode} 是设备类型 ${deviceTypeCode}（门口机应为 ${DOOR_DEVICE_TYPE}），病房：${sickroomName}`,
      );
    }
  }
  return warnings;
}
