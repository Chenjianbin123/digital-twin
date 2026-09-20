import { apiUrl, postJson } from '@/api/http-client';
import { deriveFileHostFromDeviceHost } from '@/utils/device-cache';
import { shallowRef } from 'vue';
import { measureLoadStage } from '@/core/load-timing';

/** 对齐主项目 FILE_FRONT_URL_HEAD 系统参数 */
const FILE_PARAM_KEY = 'FILE_FRONT_URL_HEAD';

const fileUrlPrefix = shallowRef('');
const loading = shallowRef(false);
let pending: Promise<void> | null = null;
let generation = 0;
let initialized = false;

function normalizePrefix(value?: string): string {
  return value?.trim().replace(/\/$/, '') ?? '';
}

export function getFileUrlPrefix(): string {
  return fileUrlPrefix.value;
}

export function setFileUrlPrefix(prefix: string) {
  fileUrlPrefix.value = normalizePrefix(prefix);
}

export function isFileUrlPrefixLoading(): boolean {
  return loading.value;
}

export function waitForFileUrlPrefix(): Promise<void> {
  return pending ?? Promise.resolve();
}

export function clearFileUrlPrefix() {
  generation++;
  initialized = false;
  pending = null;
  loading.value = false;
  setFileUrlPrefix('');
}

/** Shared readiness barrier for resource consumers, independent of area initialization. */
export function initFileUrlPrefix(): Promise<void> {
  if (pending) return pending;
  if (initialized) return Promise.resolve();
  const session = generation;
  loading.value = true;
  pending = measureLoadStage('file-prefix', async () => {
    const response = await postJson<Array<{ paramKey: string; paramValue: string }>>(
      apiUrl('device/commonDevice/querySysParamKeyValueByParamKeys'),
      { paramKeyList: [FILE_PARAM_KEY] },
    );

    const value = response.code === 200
      ? response.data?.find(row => row.paramKey === FILE_PARAM_KEY)?.paramValue : '';
    if (!value?.trim()) throw new Error('文件资源地址未配置');
    if (session === generation) setFileUrlPrefix(value);
  }).catch(() => {
    if (session === generation) setFileUrlPrefix(deriveFileHostFromDeviceHost());
  }).finally(() => {
    if (session !== generation) return;
    initialized = true;
    loading.value = false;
    pending = null;
  });
  return pending;
}
