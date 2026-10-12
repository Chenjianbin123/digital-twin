<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useTwinStore } from '@/stores/twin-store';
import { useDashboardTheme } from '@/core/use-dashboard-theme';
import { useWorkspaceBootstrap, type BootstrapContext } from '@/core/use-workspace-bootstrap';
import { defineRecoverableComponent } from '@/core/define-recoverable-component';
import StartupLoader from '@/components/StartupLoader.vue';
import AreaSelectionView from '@/components/AreaSelectionView.vue';
import '@/styles/dashboard-theme.scss';
import '@/styles/entrance-theme.scss';

const HospitalWorkspaceShell = defineRecoverableComponent(() => import('@/components/hospital/HospitalWorkspaceShell.vue'));
const { theme, toggleTheme } = useDashboardTheme();
const store = useTwinStore();
const { area, areaOptions, preferredAreaId, rememberedAreaId, isAreaListLoading,
  isAreaSwitching, pendingAreaId, areaSwitchError, areaListError } = storeToRefs(store);
const { progress: bootProgress, visible: showStartupLoader, phase: bootPhase,
  error: bootError, busy: isBootRetrying, start: bootstrapDigitalTwin,
  retry: retryAreaSelection, cancel: cancelBootstrap,
  scene: startupScene, waitingForScene, sceneError, retryScene: retryStartupScene,
} = useWorkspaceBootstrap(loadAreaSelectionContext, { waitForScene: () => !!area.value });

async function loadAreaSelectionContext(context: BootstrapContext) {
  context.onPhase(58, '加载病区数据');
  await store.loadArea();
  if (context.isCurrent() && !store.error) store.startSimulation();
  return store.error;
}

function restartLocalWorkspace() {
  cancelBootstrap();
  store.clearSessionState();
  store.setAlertOperator('操作员');
  void bootstrapDigitalTwin();
}
onMounted(() => {
  store.setAlertOperator('操作员');
  void bootstrapDigitalTwin();
});
onBeforeUnmount(() => {
  cancelBootstrap();
  store.clearSessionState();
});
</script>

<template>
  <div class="app-session" :data-theme="theme">
      <Transition name="startup-fade">
        <StartupLoader
          v-if="showStartupLoader"
          :theme="theme" :progress="bootProgress" :phase="bootPhase"
          :error="sceneError" :recovery="startupScene.state === 'component-error' ? 'reload' : 'retry'"
          :waiting-for-scene="waitingForScene"
          @toggle-theme="toggleTheme" @retry="retryStartupScene" @cancel="restartLocalWorkspace"
        />
      </Transition>
      <AreaSelectionView
        v-if="!area"
        :inert="showStartupLoader"
        :theme="theme"
        :areas="areaOptions"
        :preferred-area-id="preferredAreaId"
        :remembered-area-id="rememberedAreaId"
        :is-list-loading="isAreaListLoading || isBootRetrying"
        :is-entering="isAreaSwitching"
        :pending-area-id="pendingAreaId"
        :error="bootError || areaSwitchError || areaListError"
        @toggle-theme="toggleTheme"
        @enter="store.enterArea"
        @retry="retryAreaSelection"
      />
      <HospitalWorkspaceShell
        v-else
        :startup-loading="showStartupLoader"
        :startup-retry-key="startupScene.key"
        :onModelState="showStartupLoader ? startupScene.onState : undefined"
        :theme="theme"
        operator-name="操作员"
        operator-role=""
        @toggle-theme="toggleTheme"
      />
  </div>
</template>

<style scoped lang="scss">
.app-session { width: 100%; height: 100%; }
.startup-fade-enter-active, .startup-fade-leave-active { transition: opacity 0.5s ease, filter 0.5s ease; }
.startup-fade-enter-from, .startup-fade-leave-to { opacity: 0; filter: blur(8px); }
</style>
