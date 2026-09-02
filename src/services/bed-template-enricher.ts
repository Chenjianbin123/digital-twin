import {
  clearBedDeviceInfoCache,
  enrichAreaBedTemplateIds,
  enrichBedTemplateIds,
  loadBedDeviceDetails,
} from '@/services/bed-device-loader';

export {
  enrichAreaBedTemplateIds,
  enrichBedTemplateIds,
  loadBedDeviceDetails,
};

/** 兼容旧名称，实际清理的是完整床头设备响应缓存。 */
export const clearBedTemplateIdCache = clearBedDeviceInfoCache;
