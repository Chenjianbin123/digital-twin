import { getDataSource } from '@/api/door-device';
import { apiUrl, postJson } from '@/api/http-client';
import { getMockBedDeviceInfo } from '@/mock/bed-device-info';
import type { BedDeviceInfoData, BedDeviceInfoRequestParams } from '@/types/bed-device';
import { getApkSystemType, getMenuMode } from '@/utils/device-api';

const BED_INFO_PATH = 'device/bedDevice/queryBaseDeviceInfo';

/** 对齐主项目 apiClient.basic.queryBedDeviceInfo 入参 */
export function buildBedDeviceInfoParams(deviceCode: string): BedDeviceInfoRequestParams {
  return {
    deviceCode,
    apkSystemType: getApkSystemType(),
    menuMode: getMenuMode(),
  };
}

export async function queryBedDeviceInfo(deviceCode: string): Promise<BedDeviceInfoData> {
  const params = buildBedDeviceInfoParams(deviceCode);

  if (getDataSource() === 'mock') {
    await new Promise(r => setTimeout(r, 80));
    const mock = getMockBedDeviceInfo(deviceCode);
    if (!mock)
      throw new Error(`未找到床头机 ${deviceCode} 的 mock 数据`);
    return mock;
  }

  const res = await postJson<BedDeviceInfoData>(apiUrl(BED_INFO_PATH), params);
  if (res.code !== 200 || !res.data?.bedDeviceInfoVo)
    throw new Error(res.message || '床头机设备信息为空');
  return res.data;
}

export async function queryBedTemplateId(deviceCode: string): Promise<number> {
  const data = await queryBedDeviceInfo(deviceCode);
  const templateId = data.bedDeviceInfoVo.templateId;
  if (!templateId)
    throw new Error(`床头机 ${deviceCode} 未配置 templateId`);
  return templateId;
}
