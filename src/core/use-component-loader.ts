import { onScopeDispose, ref, shallowRef } from 'vue';

/** Timeout and stale-result protection for component code, before a model can mount. */
export function useComponentLoader<T>(loader: () => Promise<T>, onFailure: () => void, timeoutMs = 20_000) {
  const component = shallowRef<T | null>(null);
  const failed = ref(false);
  let generation = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  async function retry() {
    if (disposed) return;
    const attempt = ++generation;
    clearTimer();
    failed.value = false;
    const fail = () => {
      if (disposed || attempt !== generation) return;
      generation++;
      clearTimer();
      failed.value = true;
      onFailure();
    };
    timer = setTimeout(fail, timeoutMs);
    try {
      const loaded = await loader();
      if (disposed || attempt !== generation) return;
      clearTimer();
      component.value = loaded;
    }
    catch { fail(); }
  }
  onScopeDispose(() => { disposed = true; generation++; clearTimer(); });
  return { component, failed, retry };
}
