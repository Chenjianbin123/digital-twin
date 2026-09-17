<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useTwinStore } from '@/stores/twin-store';
import { useDashboardTheme } from '@/core/use-dashboard-theme';
import { useWorkspaceBootstrap, type BootstrapContext } from '@/core/use-workspace-bootstrap';
import { defineRecoverableComponent } from '@/core/define-recoverable-component';
import { prepareAreaSelection } from '@/core/area-selection-bootstrap';
import { AUTH_EXPIRED_EVENT, clearAuthSession, readAuthSession } from '@/core/auth-session';
import { clearAreaDiscoveryCache } from '@/api/area-context';
import { assertDeviceRuntimeConfigured, getCacheInfo } from '@/utils/device-cache';
import { initFileUrlPrefix } from '@/utils/file-prefix';
import type { AuthSession } from '@/types/auth';
import StartupLoader from '@/components/StartupLoader.vue';
import AreaSelectionView from '@/components/AreaSelectionView.vue';
import '@/styles/dashboard-theme.scss';
import '@/styles/entrance-theme.scss';

const SwpLoginGate = defineRecoverableComponent(() => import('@/components/SwpLoginGate.vue'));
const DigitalTwinWorkspace = defineRecoverableComponent(() => import('@/components/workspace/DigitalTwinWorkspace.vue'));
const { theme, toggleTheme } = useDashboardTheme();
const store = useTwinStore();
const authSession = ref<AuthSession | null>(readAuthSession());
const authNotice = ref('');
const { area, areaOptions, preferredAreaId, rememberedAreaId, isAreaListLoading,
  isAreaSwitching, pendingAreaId, areaSwitchError, areaListError } = storeToRefs(store);
const { progress: bootProgress, visible: showStartupLoader, phase: bootPhase,
  error: bootError, busy: isBootRetrying, start: bootstrapDigitalTwin,
  retry: retryAreaSelection, cancel: cancelBootstrap } = useWorkspaceBootstrap(loadAreaSelectionContext);

async function loadAreaSelectionContext(context: BootstrapContext) {
  const useRemoteDeviceApi = store.dataSource === 'remote';
  const useAreaSelection = useRemoteDeviceApi || store.dataSource === 'database';
  if (useRemoteDeviceApi) {
    getCacheInfo.init();
    clearAreaDiscoveryCache();
  }
  return prepareAreaSelection({
    useRemoteDeviceApi,
    useAreaSelection,
    assertRuntimeConfigured: assertDeviceRuntimeConfigured,
    initializeFilePrefix: useRemoteDeviceApi ? initFileUrlPrefix : async () => {},
    loadAreaOptions: store.loadAreaOptions,
    loadLocalArea: async () => {
      await store.loadArea();
      if (context.isCurrent() && !store.error && store.dataSource === 'mock') store.startSimulation();
      return store.error;
    },
    getRememberedAreaId: () => store.rememberedAreaId,
    enterRememberedArea: areaId => store.enterArea(areaId),
    ...context,
  });
}

function handleAuthenticated(session: AuthSession) {
  cancelBootstrap();
  authSession.value = session;
  store.setAlertOperator(session.user.userRealname || session.user.userName);
  authNotice.value = '';
  void bootstrapDigitalTwin();
}
function handleAuthExpired(event: Event) {
  cancelBootstrap();
  store.clearSessionState();
  authSession.value = null;
  authNotice.value = event instanceof CustomEvent && typeof event.detail?.message === 'string'
    ? event.detail.message : '登录已过期，请重新登录';
}
function handleLogout() {
  cancelBootstrap();
  clearAuthSession();
  store.clearSessionState();
  authSession.value = null;
  authNotice.value = '';
}
onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  if (authSession.value) {
    store.setAlertOperator(authSession.value.user.userRealname || authSession.value.user.userName);
    void bootstrapDigitalTwin();
  }
});
onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  store.clearSessionState();
});
</script>

<template>
  <div class="app-session" :data-theme="theme">
    <SwpLoginGate
      v-if="!authSession"
      :theme="theme"
      :notice="authNotice"
      @toggle-theme="toggleTheme"
      @authenticated="handleAuthenticated"
    />
    <template v-else>
      <Transition name="startup-fade">
        <StartupLoader v-if="showStartupLoader" :theme="theme" :progress="bootProgress" :phase="bootPhase" @toggle-theme="toggleTheme" />
      </Transition>
      <AreaSelectionView
        v-if="!area"
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
      <DigitalTwinWorkspace
        v-else
        :theme="theme"
        :operator-name="authSession.user.userRealname || authSession.user.userName"
        :operator-role="authSession.role.roleName"
        @toggle-theme="toggleTheme"
        @logout="handleLogout"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.app-session { width: 100%; height: 100%; }
.startup-fade-enter-active, .startup-fade-leave-active { transition: opacity 0.5s ease, filter 0.5s ease; }
.startup-fade-enter-from, .startup-fade-leave-to { opacity: 0; filter: blur(8px); }
</style>
