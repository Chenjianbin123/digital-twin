<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createHospital3DScene } from '@/core/hospital-3d-scene';
import SceneSwitchLoader from '@/components/SceneSwitchLoader.vue';
import type { SceneSwitchFeedback } from '@/core/scene-transition';
import type { HospitalOverview } from '@/core/hospital-navigation';
import type { StartupSceneState } from '@/core/use-workspace-bootstrap';

const props = defineProps<{ view: HospitalOverview; theme: 'light' | 'dark'; active: boolean;
  retryKey?: number }>();
const emit = defineEmits<{ enter: []; back: []; modelState: [state: StartupSceneState] }>();
const host = ref<HTMLElement>();
const state = ref<StartupSceneState>('loading'), progress = ref(0), zoom = ref(1);
const marker = ref({ x: 0, y: 0, visible: false });
let scene: ReturnType<typeof createHospital3DScene> | undefined;
let generation = 0;
const loadingFeedback = computed<SceneSwitchFeedback | null>(() => state.value === 'ready' ? null : {
  status: state.value === 'loading' ? 'loading' : 'fallback', phase: 'loading', recovery: 'retry', durationMs: 0,
  tone: props.view === 'floor' ? 'ward' : 'station',
  title: state.value === 'fallback' ? '场景加载失败' : props.view === 'floor' ? '进入病区总览' : '加载医院外部',
  subtitle: state.value === 'fallback' ? '三维场景暂未就绪，请重试加载' : props.view === 'floor'
    ? '正在准备楼层布局与护士站入口' : '正在准备医院建筑与周边环境',
  fromLabel: '医院外部', toLabel: props.view === 'floor' ? '病区总览' : '医院外部',
});
const markerStyle = computed(() => ({
  left: `${Math.max(8, Math.min(marker.value.x + 16, (host.value?.clientWidth ?? 320) - 136))}px`,
  top: `${Math.max(28, Math.min(marker.value.y, (host.value?.clientHeight ?? 320) - 28))}px`,
}));
function start() {
  const current = ++generation;
  scene?.dispose(); scene = undefined;
  state.value = 'loading'; progress.value = 0; marker.value.visible = false;
  emit('modelState', 'loading');
  if (!host.value) return;
  try {
    scene = createHospital3DScene(host.value, props.view, props.theme, {
      state(value) { if (current === generation) { state.value = value; emit('modelState', value); } },
      progress(value) { if (current === generation) progress.value = value; },
      marker(value) { if (current === generation) marker.value = value; },
      zoom(value) { if (current === generation) zoom.value = value; },
      enter,
    });
    scene.setActive(props.active);
  } catch { state.value = 'fallback'; emit('modelState', 'fallback'); }
}
function enter() { if (state.value === 'ready' && props.active) emit('enter'); }
watch(() => props.active, value => scene?.setActive(value));
watch(() => props.theme, value => scene?.setTheme(value));
watch(() => props.retryKey, start);
onMounted(start);
onBeforeUnmount(() => { generation++; scene?.dispose(); });
defineExpose({ getDiagnostics: () => scene?.diagnostics(), focusViewport: () => host.value?.focus() });
</script>

<template>
  <section class="hospital-overview" :data-view="view" :data-state="state" :data-zoom="zoom" :aria-busy="state === 'loading'">
    <div ref="host" class="hospital-overview__viewport" tabindex="0" aria-label="三维模型：点击楼层进入，拖动旋转，右键平移，滚轮缩放，方向键平移，Enter 进入下一级场景，Esc 返回医院外部" @keydown.enter.self.prevent="enter">
      <button v-if="view === 'floor' && state === 'ready' && marker.visible" class="hospital-overview__marker" :style="markerStyle" type="button"
        aria-label="进入护士站" @click.stop="enter">
        <span class="hospital-overview__marker-dot" aria-hidden="true">+</span>
        护士站 <span aria-hidden="true">›</span>
      </button>
    </div>
    <SceneSwitchLoader :feedback="active ? loadingFeedback : null" :progress="progress" full-screen>
      <template v-if="view === 'exterior'" #icon>
        <path d="M12 54V18h40v36M7 54h50M25 18V8h14v10M32 10v6m-3-3h6M19 26h6m14 0h6M19 34h6m14 0h6M19 42h6m14 0h6M28 54V42h8v12" />
      </template>
      <template #footnote>{{ state === 'fallback' ? '可重新尝试加载三维场景。' : '首次进入需加载三维资源，请稍候。' }}</template>
      <template v-if="view === 'floor' || state === 'fallback'" #actions>
        <button v-if="view === 'floor'" type="button" @click="emit('back')">返回医院外部</button>
        <button v-if="state === 'fallback'" type="button" class="scene-switch-loader__retry" @click="start">重试加载 <span aria-hidden="true">↻</span></button>
      </template>
    </SceneSwitchLoader>
  </section>
</template>

<style scoped lang="scss" src="./hospital-overview.scss"></style>
