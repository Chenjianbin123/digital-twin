import { computed, onScopeDispose, reactive, ref, watch, type Ref } from 'vue';
import { resolveSceneSwitchFeedback, type SceneSwitchFeedback } from './scene-transition.ts';
import type { TwinSceneType } from '../types/twin';

type ModelState = 'loading' | 'ready' | 'fallback';

function createEntry(key: string) {
  const entry = reactive({
    key,
    requested: false,
    state: 'loading' as ModelState,
    recovery: 'retry' as 'retry' | 'reload',
    // Bind updates to this entry so late callbacks cannot complete a newer session.
    onState: (state: ModelState | 'component-error'): void => {
      entry.state = state === 'component-error' ? 'fallback' : state;
      entry.recovery = state === 'component-error' ? 'reload' : 'retry';
    },
  });
  return entry;
}

export function useSceneLoading(
  scope: Readonly<Ref<string | null>>,
  target: Readonly<Ref<TwinSceneType | null>>,
) {
  let generation = 0;
  function createSession() {
    const key = ++generation;
    return {
      'nurse-station': createEntry(`${key}:station`),
      ward: createEntry(`${key}:corridor`),
      'ward-interior': createEntry(`${key}:interior`),
    };
  }
  const scenes = ref(createSession());
  const from = ref<TwinSceneType>('nurse-station');
  let previous: TwinSceneType = 'nurse-station';
  const switching = ref(false);
  let switchTimer: ReturnType<typeof setTimeout> | undefined;
  let switchVersion = 0;

  function cancelSwitch() {
    ++switchVersion;
    clearTimeout(switchTimer);
    switchTimer = undefined;
    switching.value = false;
  }
  onScopeDispose(cancelSwitch);

  watch(scope, () => {
    cancelSwitch();
    scenes.value = createSession();
    previous = 'nurse-station';
    from.value = previous;
  }, { flush: 'sync' });

  // Coalesce the store's area-id and scene-type updates before mounting anything.
  // This also covers room/alert links which bypass the bottom navigation.
  watch([scope, target], ([identity, type]) => {
    cancelSwitch();
    if (!identity || !type)
      return;
    from.value = previous;
    const transition = resolveSceneSwitchFeedback(previous, type);
    if (transition) {
      // Keep visual feedback separate from readiness: cached scenes stay mounted.
      switching.value = true;
      const version = switchVersion;
      switchTimer = setTimeout(() => {
        if (version !== switchVersion)
          return;
        switching.value = false;
        switchTimer = undefined;
      }, transition.durationMs);
    }
    previous = type;
    scenes.value[type].requested = true;
  }, { immediate: true });

  const feedback = computed<SceneSwitchFeedback | null>(() => {
    const type = target.value;
    if (!scope.value || !type)
      return null;
    const entry = scenes.value[type];
    if (!entry.requested || (entry.state === 'ready' && !switching.value))
      return null;
    const transition = resolveSceneSwitchFeedback(from.value, type)
      ?? resolveSceneSwitchFeedback(type === 'nurse-station' ? 'ward' : 'nurse-station', type)!;
    return {
      ...transition,
      title: from.value === type ? `加载${transition.toLabel}` : transition.title,
      fromLabel: from.value === type ? transition.toLabel : transition.fromLabel,
      status: entry.state === 'fallback' ? 'fallback' : 'loading',
      phase: entry.state === 'ready' ? 'switching' : 'loading',
      recovery: entry.recovery,
      subtitle: entry.recovery === 'reload'
        ? '页面资源加载失败，请检查网络后刷新页面'
        : entry.state === 'fallback'
        ? '场景加载失败，可重试或返回护士站'
        : entry.state === 'ready'
        ? transition.subtitle
        : '正在加载模型与准备首帧，首次进入需要稍候',
    };
  });

  function retry() {
    const type = target.value;
    if (!scope.value || !type || scenes.value[type].state !== 'fallback' || scenes.value[type].recovery === 'reload')
      return;
    const entry = createEntry(`${++generation}:${type}:retry`);
    entry.requested = true;
    scenes.value[type] = entry;
  }

  return { scenes, feedback, retry };
}
