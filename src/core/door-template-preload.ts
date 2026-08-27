interface DoorTemplateDevice {
  doorDeviceInfo: {
    deviceCode: string;
    templateId: number;
  };
}

export interface DoorTemplatePreloadResult {
  templateIds: number[];
  warnings: string[];
}

/** 在门口机详情加载完成后，按去重后的 templateId 预加载真实模板。 */
export async function preloadDoorTemplates(
  devices: DoorTemplateDevice[],
  loadTemplate: (templateId: number) => Promise<unknown>,
): Promise<DoorTemplatePreloadResult> {
  const warnings = devices
    .filter(device => !device.doorDeviceInfo.templateId)
    .map(device => `${device.doorDeviceInfo.deviceCode} 门口机未配置模板`);
  const templateIds = [...new Set(
    devices
      .map(device => Number(device.doorDeviceInfo.templateId))
      .filter(id => Number.isFinite(id) && id > 0),
  )];
  console.info('[DoorTemplate] 预加载模板', {
    deviceCount: devices.length,
    templateIds,
    missingTemplateCount: warnings.length,
  });

  const settled = await Promise.allSettled(
    templateIds.map(templateId => loadTemplate(templateId)),
  );
  const loadedTemplateIds: number[] = [];

  settled.forEach((item, index) => {
    const templateId = templateIds[index];
    if (item.status === 'fulfilled') {
      loadedTemplateIds.push(templateId);
      return;
    }
    const reason = item.reason instanceof Error ? item.reason.message : '查询失败';
    warnings.push(`模板 ${templateId} 加载失败：${reason}`);
  });

  return { templateIds: loadedTemplateIds, warnings };
}
