import { queryBedDeviceInfo } from '@/api/bed-device';
import {
  applyBedDeviceInfoToTwinBed,
  isBedDeviceResponseApplicable,
  shouldWarnForMissingBedDevice,
} from '@/core/bed-device-mapping';
import { loadParsedTemplate } from '@/core/template/template-cache';
import type { BedDeviceInfoData } from '@/types/bed-device';
import type { TwinBedEntity } from '@/types/twin';

const bedInfoCache = new Map<string, BedDeviceInfoData>();

export interface BedDeviceLoadOptions {
  forceRefresh?: boolean;
}

export interface BedDeviceLoadResult {
  warnings: string[];
  loaded: number;
  failed: number;
}

async function loadOneBedDeviceInfo(
  deviceCode: string,
  forceRefresh: boolean,
): Promise<BedDeviceInfoData> {
  if (!forceRefresh) {
    const cached = bedInfoCache.get(deviceCode);
    if (cached)
      return structuredClone(cached);
  }
  const data = await queryBedDeviceInfo(deviceCode);
  bedInfoCache.set(deviceCode, structuredClone(data));
  return data;
}

/**
 * 按床头机 SN 批量加载完整设备信息。
 * 同一 SN 只请求一次，失败的床位不影响其他床位，返回可展示的逐项警告。
 */
export async function loadBedDeviceDetails(
  beds: TwinBedEntity[],
  isCurrent: () => boolean = () => true,
  options: BedDeviceLoadOptions = {},
): Promise<BedDeviceLoadResult> {
  const warnings: string[] = [];
  const bedGroups = new Map<string, TwinBedEntity[]>();
  let loaded = 0;
  let failed = 0;

  for (const bed of beds) {
    const deviceCode = bed.deviceCode.trim();
    if (!deviceCode) {
      if (shouldWarnForMissingBedDevice(bed)) {
        warnings.push(`${bed.bedName || bed.bedCode || '未知床位'} 未关联床头机设备`);
        failed += 1;
      }
      continue;
    }
    const group = bedGroups.get(deviceCode) ?? [];
    group.push(bed);
    bedGroups.set(deviceCode, group);
  }

  const entries = [...bedGroups.entries()];
  const settled = await Promise.allSettled(
    entries.map(([deviceCode]) => loadOneBedDeviceInfo(deviceCode, !!options.forceRefresh)),
  );

  settled.forEach((result, index) => {
    const [deviceCode, group] = entries[index];
    if (result.status === 'fulfilled') {
      if (isCurrent()) {
        group.forEach((bed) => {
          if (!isBedDeviceResponseApplicable(bed, deviceCode, result.value)) {
            const responseCode = String(result.value.bedDeviceInfoVo?.deviceCode ?? '').trim() || '未知设备';
            warnings.push(
              `${bed.bedName || bed.bedCode || '未知床位'} 床头机响应不匹配（请求 ${deviceCode}，返回 ${responseCode}），已忽略`,
            );
            failed += 1;
            return;
          }
          applyBedDeviceInfoToTwinBed(bed, result.value);
          loaded += 1;
        });
      }
      return;
    }
    failed += group.length;
    const reason = result.reason instanceof Error ? result.reason.message : '查询失败';
    warnings.push(`${deviceCode} 床头机信息加载失败：${reason}`);
  });

  return { warnings, loaded, failed };
}

/** 按床头机返回的 templateId 去重预解析模板，避免进入病房后才首次请求。 */
export async function preloadBedTemplates(
  beds: TwinBedEntity[],
): Promise<string[]> {
  const warnings: string[] = [];
  const idsByBed = new Map<number, TwinBedEntity[]>();
  for (const bed of beds) {
    const id = Number(bed.templateId);
    if (!Number.isFinite(id) || id <= 0) {
      warnings.push(`${bed.bedName || bed.bedCode || '未知床位'} 未配置床头机模板`);
      continue;
    }
    const group = idsByBed.get(id) ?? [];
    group.push(bed);
    idsByBed.set(id, group);
  }

  const entries = [...idsByBed.entries()];
  const settled = await Promise.allSettled(entries.map(([id]) => loadParsedTemplate(id)));
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled')
      return;
    const [id, group] = entries[index];
    const reason = result.reason instanceof Error ? result.reason.message : '解析失败';
    warnings.push(`${group.map(bed => bed.bedName).join('、')} 床头机模板 ${id} 加载失败：${reason}`);
  });
  return warnings;
}

/** 兼容旧调用名：现在同时加载患者、护理标签和模板 ID。 */
export async function enrichBedTemplateIds(
  beds: TwinBedEntity[],
  isCurrent: () => boolean = () => true,
): Promise<string[]> {
  const result = await loadBedDeviceDetails(beds, isCurrent, { forceRefresh: true });
  return result.warnings;
}

export async function enrichAreaBedTemplateIds(
  area: { rooms: Array<{ beds: TwinBedEntity[] }> },
  isCurrent: () => boolean = () => true,
): Promise<string[]> {
  const beds = area.rooms.flatMap(room => room.beds);
  const result = await loadBedDeviceDetails(beds, isCurrent, { forceRefresh: true });
  return result.warnings;
}

export function clearBedDeviceInfoCache(): void {
  bedInfoCache.clear();
}

/** 旧名称保留，避免外部清理逻辑失效。 */
export const clearBedTemplateIdCache = clearBedDeviceInfoCache;
