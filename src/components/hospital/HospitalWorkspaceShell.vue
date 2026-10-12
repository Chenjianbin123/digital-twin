<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useTwinStore } from '@/stores/twin-store';
import { useHospitalNavigation } from '@/core/use-hospital-navigation';
import { defineRecoverableComponent } from '@/core/define-recoverable-component';
import type { StartupSceneState } from '@/core/use-workspace-bootstrap';
import HospitalModelScene from './HospitalModelScene.vue';

const props = defineProps<{ theme: 'light' | 'dark'; operatorName: string; operatorRole: string;
  startupLoading?: boolean; startupRetryKey?: number }>();
const emit = defineEmits<{ toggleTheme: []; modelState: [state: StartupSceneState] }>();
const DigitalTwinWorkspace = defineRecoverableComponent(() => import('@/components/workspace/DigitalTwinWorkspace.vue'));
const store = useTwinStore();
const { selectedAreaId, sceneType } = storeToRefs(store);
const { view, floorVisited, clinicalVisited, clinicalActive, openFloor, openClinical, openExterior } = useHospitalNavigation(sceneType);
const exteriorScene = ref<InstanceType<typeof HospitalModelScene>>();
const floorScene = ref<InstanceType<typeof HospitalModelScene>>();
const returnButton = ref<HTMLButtonElement>();
function enterStation() { store.setSceneType('nurse-station'); openClinical(); }
watch(view, async value => {
  await nextTick();
  if (value === 'exterior') exteriorScene.value?.focusViewport();
  else if (value === 'floor') floorScene.value?.focusViewport();
  else returnButton.value?.focus();
});
function exteriorState(state: StartupSceneState) {
  if (props.startupLoading) emit('modelState', state);
}
</script>

<template>
  <div class="hospital-workspace" :data-theme="theme" :data-hospital-view="view" :inert="startupLoading">
    <div v-show="!clinicalActive" class="hospital-workspace__overview" :inert="clinicalActive" @keydown.esc="openExterior">
      <div class="hospital-workspace__scenes">
        <Transition name="hospital-stage">
          <HospitalModelScene ref="exteriorScene" v-show="view === 'exterior'" view="exterior" :theme="theme"
            :active="view === 'exterior'" :retry-key="startupRetryKey" :inert="view !== 'exterior'"
            @enter="openFloor" @model-state="exteriorState" />
        </Transition>
        <Transition name="hospital-stage">
          <HospitalModelScene ref="floorScene" v-if="floorVisited" v-show="view === 'floor'" :key="selectedAreaId ?? 'current-area'"
            view="floor" :theme="theme" :active="view === 'floor'" :inert="view !== 'floor'"
            @enter="enterStation" @back="openExterior" />
        </Transition>
      </div>
    </div>
    <DigitalTwinWorkspace v-if="clinicalVisited" v-show="clinicalActive" :active="clinicalActive" :inert="!clinicalActive"
      :theme="theme" :operator-name="operatorName" :operator-role="operatorRole" @toggle-theme="emit('toggleTheme')" />
    <nav v-if="clinicalActive" class="hospital-workspace__return" aria-label="返回医院总览">
      <button ref="returnButton" type="button" @click="openFloor">‹ 返回楼层总览</button>
      <button type="button" @click="openExterior">医院外部</button>
    </nav>
  </div>
</template>

<style lang="scss" src="./hospital-workspace.scss"></style>
