import { queryBedTemplateId } from '@/api/bed-device';
import type { TwinAreaEntity, TwinBedEntity } from '@/types/twin';

const templateIdCache = new Map<string, number>();

async function resolveBedTemplateId(bed: TwinBedEntity): Promise<number | undefined> {
  if (bed.templateId)
    return bed.templateId;

  if (!bed.deviceCode.trim())
    return undefined;

  const cached = templateIdCache.get(bed.deviceCode);
  if (cached)
    return cached;

  try {
    const templateId = await queryBedTemplateId(bed.deviceCode);
    templateIdCache.set(bed.deviceCode, templateId);
    return templateId;
  }
  catch {
    return undefined;
  }
}

/** 按主项目逻辑：通过 queryBedDeviceInfo 获取每床 bedDeviceInfoVo.templateId */
export async function enrichBedTemplateIds(
  beds: TwinBedEntity[],
  isCurrent: () => boolean = () => true,
): Promise<string[]> {
  const warnings: string[] = [];
  await Promise.all(beds.map(async (bed) => {
    const templateId = await resolveBedTemplateId(bed);
    if (templateId && isCurrent())
      bed.templateId = templateId;
    else if (!templateId)
      warnings.push(bed.deviceCode
        ? `${bed.deviceCode} 床头屏模板加载失败`
        : `${bed.bedName} 未关联床头机设备`);
  }));
  return warnings;
}

export async function enrichAreaBedTemplateIds(area: TwinAreaEntity): Promise<void> {
  const beds = area.rooms.flatMap(room => room.beds);
  await enrichBedTemplateIds(beds);
}

export function clearBedTemplateIdCache() {
  templateIdCache.clear();
}
