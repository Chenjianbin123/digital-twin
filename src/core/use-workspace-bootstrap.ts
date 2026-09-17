import { onScopeDispose, ref } from 'vue';

export interface BootstrapContext {
  isCurrent: () => boolean;
  onPhase: (progress: number, phase: string) => void;
}

/** Own every delayed write, including the final fade, for one authenticated session. */
export function useWorkspaceBootstrap(load: (context: BootstrapContext) => Promise<string | null>) {
  const progress = ref(0);
  const visible = ref(false);
  const phase = ref('初始化智慧病房资源');
  const error = ref<string | null>(null);
  const busy = ref(false);
  let generation = 0;
  let started = false;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function clearTimer() {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  function cancel() {
    generation++;
    clearTimer();
    started = false;
    busy.value = false;
    visible.value = false;
    error.value = null;
    progress.value = 0;
  }

  async function run(showProgress: boolean) {
    if (disposed || busy.value) return;
    const session = ++generation;
    const isCurrent = () => !disposed && generation === session;
    const startedAt = Date.now();
    let target = 4;
    let completedAt: number | null = null;
    let loaded = false;
    clearTimer();
    busy.value = true;
    error.value = null;
    visible.value = showProgress;
    progress.value = 0;
    phase.value = '初始化智慧病房资源';
    if (showProgress) {
      timer = setInterval(() => {
        if (!isCurrent()) return;
        if (loaded && Date.now() - startedAt >= 1400) {
          target = 100;
          phase.value = error.value ? '初始化未完成，请重试' : '正在进入工作空间';
        }
        const gap = target - progress.value;
        const step = target === 100 ? 3.2 : gap > 18 ? 3.4 : gap > 7 ? 2.2 : 1.05;
        progress.value = Math.min(target, progress.value + step);
        if (progress.value < 100) return;
        completedAt ??= Date.now();
        if (Date.now() - completedAt < 260) return;
        clearTimer();
        visible.value = false;
        busy.value = false;
      }, 56);
    }
    try {
      const result = await load({
        isCurrent,
        onPhase: (value, label) => {
          if (!isCurrent()) return;
          target = Math.max(target, Math.min(86, value));
          phase.value = label;
        },
      });
      if (isCurrent()) error.value = result;
    }
    catch (cause) {
      if (isCurrent()) error.value = cause instanceof Error ? cause.message : '初始化失败';
    }
    finally {
      if (isCurrent()) {
        loaded = true;
        target = 86;
        if (!showProgress) busy.value = false;
      }
    }
  }

  function start() {
    if (started || disposed) return;
    started = true;
    return run(true);
  }

  onScopeDispose(() => { cancel(); disposed = true; });
  return { progress, visible, phase, error, busy, start, retry: () => run(false), cancel };
}
