import { onScopeDispose, ref } from 'vue';

export interface BootstrapContext {
  isCurrent: () => boolean;
  onPhase: (progress: number, phase: string) => void;
}

export type StartupSceneState = 'loading' | 'ready' | 'fallback' | 'component-error';
export interface StartupSceneAttempt {
  key: number;
  state: StartupSceneState;
  onState: (state: StartupSceneState) => void;
}

/** Own every delayed write, including the final fade, for one authenticated session. */
export function useWorkspaceBootstrap(
  load: (context: BootstrapContext) => Promise<string | null>,
  options: { waitForScene?: () => boolean } = {},
) {
  const progress = ref(0);
  const visible = ref(false);
  const phase = ref('初始化智慧病房资源');
  const error = ref<string | null>(null);
  const busy = ref(false);
  const waitingForScene = ref(false);
  const sceneError = ref<string | null>(null);
  let attempt = 0;
  const scene = ref<StartupSceneAttempt>({ key: 0, state: 'loading', onState() {} });
  let restartScene: (() => void) | undefined;
  let generation = 0;
  let started = false;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let completionTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer !== undefined) clearInterval(timer);
    if (completionTimer !== undefined) clearTimeout(completionTimer);
    timer = undefined;
    completionTimer = undefined;
  }

  function cancel() {
    generation++;
    clearTimer();
    started = false;
    busy.value = false;
    visible.value = false;
    error.value = null;
    progress.value = 0;
    waitingForScene.value = false;
    sceneError.value = null;
    restartScene = undefined;
  }

  async function run(showProgress: boolean) {
    if (disposed || busy.value) return;
    const session = ++generation;
    const isCurrent = () => !disposed && generation === session;
    const startedAt = Date.now();
    let target = 4;
    let loaded = false;
    let closing = false;
    clearTimer();
    busy.value = true;
    error.value = null;
    visible.value = showProgress;
    progress.value = 0;
    phase.value = '初始化智慧病房资源';
    waitingForScene.value = false;
    sceneError.value = null;

    function finishWhenReady() {
      if (!isCurrent() || !loaded || closing) return;
      clearTimer();
      // Data readiness does not imply that the workspace has rendered its first frame.
      waitingForScene.value = !error.value && showProgress && !!options.waitForScene?.();
      if (waitingForScene.value && scene.value.state !== 'ready') {
        progress.value = Math.max(progress.value, 86);
        sceneError.value = scene.value.state === 'component-error'
          ? '页面资源加载失败，请检查网络后刷新页面'
          : scene.value.state === 'fallback' ? '护士站模型加载失败，请重试' : null;
        phase.value = sceneError.value ?? '加载护士站模型与准备首帧';
        return;
      }
      waitingForScene.value = false;
      sceneError.value = null;
      closing = true;
      progress.value = 100;
      phase.value = error.value ? '初始化未完成，请重试' : '正在进入工作空间';
      if (showProgress) {
        completionTimer = setTimeout(() => {
          if (!isCurrent()) return;
          completionTimer = undefined;
          visible.value = false;
          busy.value = false;
        }, Math.max(80, 180 - (Date.now() - startedAt)));
      }
      else busy.value = false;
    }

    function beginSceneAttempt() {
      const key = ++attempt;
      scene.value = { key, state: 'loading', onState(state) {
        if (!isCurrent() || closing || scene.value.key !== key) return;
        scene.value.state = state;
        finishWhenReady();
      } };
      finishWhenReady();
    }
    beginSceneAttempt();
    restartScene = () => {
      if (isCurrent() && waitingForScene.value && scene.value.state === 'fallback') beginSceneAttempt();
    };
    if (showProgress) {
      timer = setInterval(() => {
        if (!isCurrent()) return;
        const gap = target - progress.value;
        const step = gap > 18 ? 3.4 : gap > 7 ? 2.2 : 1.05;
        progress.value = Math.min(target, progress.value + step);
      }, 56);
    }
    try {
      const result = await load({
        isCurrent,
        onPhase: (value, label) => {
          if (!isCurrent() || loaded) return;
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
        finishWhenReady();
      }
    }
  }

  function start() {
    if (started || disposed) return;
    started = true;
    return run(true);
  }

  onScopeDispose(() => { cancel(); disposed = true; });
  return { progress, visible, phase, error, busy, start, retry: () => run(false), cancel,
    scene, waitingForScene, sceneError, retryScene: () => restartScene?.() };
}
