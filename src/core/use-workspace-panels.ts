import { computed, ref, watch, type Ref } from 'vue';
import type { TwinSceneType, WardInteriorView } from '../types/twin.ts';

type PanelView = TwinSceneType | 'plan';

export function useWorkspacePanels(
  scene: Readonly<Ref<TwinSceneType>>,
  interiorView: Readonly<Ref<WardInteriorView>>,
  scope: Readonly<Ref<string | null>>,
) {
  const preferences = ref<Partial<Record<PanelView, boolean>>>({});
  const view = computed<PanelView>(() =>
    scene.value === 'ward-interior' && interiorView.value === 'plan' ? 'plan' : scene.value);
  const panelsVisible = computed({
    get: () => preferences.value[view.value] ?? view.value !== 'plan',
    set: (visible: boolean) => { preferences.value[view.value] = visible; },
  });
  watch(scope, () => { preferences.value = {}; }, { flush: 'sync' });
  return { panelsVisible };
}
