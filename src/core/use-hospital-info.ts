import { ref } from 'vue';
import type { HospitalInfo } from '../types/hospital.ts';
import { measureLoadStage } from './load-timing.ts';

/** Hospital-wide metadata is independent of ward snapshots, but never survives logout. */
export function useHospitalInfo(fetchInfo: () => Promise<HospitalInfo | null>) {
  const info = ref<HospitalInfo | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let generation = 0;
  let pending: Promise<void> | null = null;

  function load(force = false): Promise<void> {
    if (pending) return pending;
    if (info.value && !force) return Promise.resolve();
    const session = generation;
    loading.value = true;
    error.value = null;
    pending = measureLoadStage('hospital-info', async () => {
      const result = await fetchInfo();
      if (!result) throw new Error('医院基本信息接口失败或返回空数据');
      return result;
    }).then(result => {
      if (session === generation) info.value = result;
    }).catch(cause => {
      if (session === generation)
        error.value = cause instanceof Error ? cause.message : '医院基本信息加载失败';
    }).finally(() => {
      if (session !== generation) return;
      loading.value = false;
      pending = null;
    });
    return pending;
  }

  function clear() {
    generation++;
    pending = null;
    info.value = null;
    loading.value = false;
    error.value = null;
  }

  return { info, loading, error, load, clear };
}
