import { computed, reactive, ref, watch, type Ref } from 'vue';
import { resolveSceneSwitchFeedback, type SceneSwitchFeedback } from './scene-transition.ts';
import type { TwinSceneType } from '../types/twin';

type ModelState = 'loading' | 'ready' | 'fallback';

function createEntry(key: string) {
  const entry = reactive({
    key,
    requested: false,
    state: 'loading' as ModelState,
    // Bind updates to this entry so late callbacks cannot complete a newer session.
    onState: (state: ModelState): void => { entry.state = state; },
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

  watch(scope, () => {
    scenes.value = createSession();
    previous = 'nurse-station';
    from.value = previous;
  }, { flush: 'sync' });

  // Coalesce the store's area-id and scene-type updates before mounting anything.
  // This also covers room/alert links which bypass the bottom navigation.
  watch([scope, target], ([identity, type]) => {
    if (!identity || !type)
      return;
    from.value = previous;
    previous = type;
    scenes.value[type].requested = true;
  }, { immediate: true });

  const feedback = computed<SceneSwitchFeedback | null>(() => {
    const type = target.value;
    if (!scope.value || !type)
      return null;
    const entry = scenes.value[type];
    if (!entry.requested || entry.state === 'ready')
      return null;
    const transition = resolveSceneSwitchFeedback(from.value, type)
      ?? resolveSceneSwitchFeedback(type === 'nurse-station' ? 'ward' : 'nurse-station', type)!;
    return {
      ...transition,
      title: from.value === type ? `加载${transition.toLabel}` : transition.title,
      fromLabel: from.value === type ? transition.toLabel : transition.fromLabel,
      status: entry.state,
      subtitle: entry.state === 'fallback'
        ? '场景加载失败，可重试或返回护士站'
        : '正在加载模型与准备首帧，首次进入需要稍候',
    };
  });

  function retry() {
    const type = target.value;
    if (!scope.value || !type || scenes.value[type].state !== 'fallback')
      return;
    const entry = createEntry(`${++generation}:${type}:retry`);
    entry.requested = true;
    scenes.value[type] = entry;
  }

  return { scenes, feedback, retry };
}
