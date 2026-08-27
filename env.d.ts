/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE: 'mock' | 'remote' | 'database';
  /** querySwpDeviceInfo 病区筛选（可选） */
  readonly VITE_AREA_ID?: string;
  /** querySwpDeviceInfo 科室筛选（可选） */
  readonly VITE_DEPT_ID?: string;
  /** 对齐主项目 getCacheInfo('host')，如 http://192.168.96.104 */
  readonly VITE_DEVICE_HOST?: string;
  /** @deprecated 已改用 querySwpDeviceInfo，无需配置 SN */
  readonly VITE_DEVICE_SN?: string;
  /** @deprecated 使用 VITE_DEVICE_HOST */
  readonly VITE_API_BASE_URL?: string;
  /** @deprecated 使用 VITE_DEVICE_SN */
  readonly VITE_SEED_DEVICE_CODE?: string;
  readonly VITE_SWP_DEVICE_TYPE_ID?: string;
  readonly VITE_APK_SYSTEM_TYPE?: string;
  readonly VITE_MENU_MODE?: string;
  /** 统一接口超时时间（毫秒），默认 6000 */
  readonly VITE_API_TIMEOUT_MS?: string;
  /** SWP 接口鉴权 token（请求头 token） */
  readonly VITE_API_TOKEN?: string;
  /** 数据库适配器浏览器访问基准路径，默认 /db-adapter */
  readonly VITE_DB_ADAPTER_BASE?: string;
  /** 数据库适配器开发代理目标，默认 http://127.0.0.1:8788 */
  readonly VITE_DB_ADAPTER_TARGET?: string;
  /** 数据库模式默认病区代码 */
  readonly VITE_DB_AREA_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
