import { apiUrl, postJson } from '@/api/http-client';
import { deriveFileHostFromDeviceHost } from '@/utils/device-cache';

/** 对齐主项目 FILE_FRONT_URL_HEAD 系统参数 */
const FILE_PARAM_KEY = 'FILE_FRONT_URL_HEAD';

let fileUrlPrefix = '';

function normalizePrefix(value?: string): string {
  return value?.trim().replace(/\/$/, '') ?? '';
}

export function getFileUrlPrefix(): string {
  return fileUrlPrefix;
}

export function setFileUrlPrefix(prefix: string) {
  fileUrlPrefix = normalizePrefix(prefix);
}

/** 从后端拉取资源域名，与门口机主项目一致 */
export async function initFileUrlPrefix(): Promise<void> {
  try {
    const response = await postJson<Array<{ paramKey: string; paramValue: string }>>(
      apiUrl('device/commonDevice/querySysParamKeyValueByParamKeys'),
      { paramKeyList: [FILE_PARAM_KEY] },
    );

    if (response.code !== 200 || !response.data?.length)
      return;

    const item = response.data.find(row => row.paramKey === FILE_PARAM_KEY);
    if (item?.paramValue)
      setFileUrlPrefix(item.paramValue);
  }
  catch {
    const fallback = deriveFileHostFromDeviceHost();
    if (fallback)
      setFileUrlPrefix(fallback);
  }
}
