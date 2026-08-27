import { ApkSystemEnum, MenuModeEnum } from '@/constants/device';

/** 对齐主项目 queryBedDeviceInfo / queryDoorDeviceInfo 的 apkSystemType */
export function getApkSystemType(): string {
  return import.meta.env.VITE_APK_SYSTEM_TYPE?.trim() || ApkSystemEnum.ANDROID;
}

/** 对齐主项目 queryBedDeviceInfo 的 menuMode，默认普通模式 */
export function getMenuMode(): string {
  const mode = import.meta.env.VITE_MENU_MODE?.trim();
  if (mode === MenuModeEnum.MEDICAL || mode === MenuModeEnum.NORMAL)
    return mode;
  return MenuModeEnum.NORMAL;
}
