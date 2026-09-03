<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DashboardAreaNav from '@/components/dashboard/DashboardAreaNav.vue';
import DashboardBottomNav from '@/components/dashboard/DashboardBottomNav.vue';
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue';
import DashboardLeftPanel from '@/components/dashboard/DashboardLeftPanel.vue';
import AreaSelectionView from '@/components/AreaSelectionView.vue';
import AreaSwitcher from '@/components/AreaSwitcher.vue';
import StartupLoader from '@/components/StartupLoader.vue';
import SceneSwitchLoader from '@/components/SceneSwitchLoader.vue';
import NurseStationPanel from '@/components/NurseStationPanel.vue';
import NurseStationVisualScene from '@/components/NurseStationVisualScene.vue';
import HospitalIntroPanel from '@/components/HospitalIntroPanel.vue';
import AreaInfoPanel from '@/components/AreaInfoPanel.vue';
import EnvAlertBanner from '@/components/EnvAlertBanner.vue';
import WardInfoPanel from '@/components/WardInfoPanel.vue';
import WardLegend from '@/components/WardLegend.vue';
import WardPlanBedDialog from '@/components/WardPlanBedDialog.vue';
import SwpLoginGate from '@/components/SwpLoginGate.vue';
import { formatBedLabel } from '@/core/alert-workflow';
import type { AlertTask } from '@/core/alert-workflow';
import { buildAreaSceneIdentity } from '@/core/area-scene-identity';
import { prepareAreaSelection } from '@/core/area-selection-bootstrap';
import { resolveSceneSwitchFeedback, type SceneSwitchFeedback } from '@/core/scene-transition';
import { getWardBedStats } from '@/types/twin';
import { useTwinStore } from '@/stores/twin-store';
import { clearAreaDiscoveryCache } from '@/api/area-context';
import { assertDeviceRuntimeConfigured, getCacheInfo } from '@/utils/device-cache';
import { initFileUrlPrefix } from '@/utils/file-prefix';
import {
  AUTH_EXPIRED_EVENT,
  clearAuthSession,
  readAuthSession,
} from '@/core/auth-session';
import type { AuthSession } from '@/types/auth';
import type { AreaModelState } from '@/core/area-scene';
import { resolveDataStatus } from '@/core/data-status';
import { ALERT_ACK_STORAGE_KEY } from '@/core/alert-ack';
import { SWP_CALL_ALERTS_STORAGE_KEY } from '@/services/swp-call-notifier';

const store = useTwinStore();
const AreaScene3D = defineAsyncComponent(() => import('@/components/AreaScene3D.vue'));
const WardScene3D = defineAsyncComponent(() => import('@/components/WardScene3D.vue'));
const WardPlanView = defineAsyncComponent(() => import('@/components/WardPlanView.vue'));
const authSession = ref<AuthSession | null>(readAuthSession());
const authNotice = ref('');
const bootProgress = ref(0);
const bootTargetProgress = ref(0);
const showStartupLoader = ref(!!authSession.value);
const bootPhase = ref('初始化智慧病房资源');
const isAreaSwitcherOpen = ref(false);
const bootError = ref<string | null>(null);
const isBootRetrying = ref(false);
const sceneSwitchFeedback = ref<SceneSwitchFeedback | null>(null);
const panelsVisible = ref(true);
const stationModelState = ref<AreaModelState>('loading');
const MIN_STARTUP_DURATION = 1400;
let bootTimer: ReturnType<typeof setInterval> | null = null;
let bootStartedAt = 0;
let sceneSwitchTimer: number | null = null;
let dataStatusTimer: number | null = null;
let hasBootstrapped = false;
let bootGeneration = 0;
const dataStatusNow = ref(Date.now());

const {
  area,
  areaOptions,
  selectedAreaId,
  pendingAreaId,
  preferredAreaId,
  rememberedAreaId,
  isAreaListLoading,
  isAreaSwitching,
  areaListError,
  areaSwitchError,
  currentWard,
  selectedBed,
  selectedStatus,
  sceneType,
  wardInteriorView,
  isNurseStation,
  isWard,
  isWardInterior,
  cameraPreset,
  isSimulating,
  isLoading,
  statusHistory,
  currentRoomIndex,
  currentEnvAlert,
  roomSummaries,
  dataSource,
  deviceCodes,
  hospitalInfo,
  hospitalInfoLoading,
  dataWarnings,
  dataPhase,
  lastFetchedAtMs,
  bedDetailsLoading,
  bedDetailsError,
  alertTasks,
  hiddenAlertTasks,
  activeAlertTask,
  alertAckRecords,
  alertLocateNotice,
  callAlertsEnabled,
  swpEvents,
  swpResponseMetrics,
  swpEventSync,
  swpResponseSync,
  inspectionRoomSummaries,
  inspectionSync,
} = storeToRefs(store);

const dataStatus = computed(() => resolveDataStatus({
  phase: dataPhase.value,
  hasWarnings: dataWarnings.value.length > 0,
  lastFetchedAtMs: lastFetchedAtMs.value,
  nowMs: dataStatusNow.value,
}));

const preloadedWard = computed(() => currentWard.value ?? area.value?.rooms[0] ?? null);
const currentInspectionSummary = computed(() =>
  currentRoomIndex.value >= 0
    ? inspectionRoomSummaries.value[currentRoomIndex.value] ?? null
    : null,
);
const stationSceneActive = computed(() => isNurseStation.value);
const corridorSceneActive = computed(() => isWard.value);
const interiorSceneActive = computed(() => isWardInterior.value && wardInteriorView.value === '3d');

watch([() => isWardInterior.value, () => wardInteriorView.value], ([interior, view]) => {
  if (interior && view === 'plan')
    panelsVisible.value = false;
});

function handlingActionText() {
  return '处理中';
}

function canMarkHandling(task: AlertTask) {
  return !isDisplayOnlySwpCall(task) && task.status !== 'handling';
}

function isDisplayOnlySwpCall(task: AlertTask) {
  return task.source === 'swp-call' && task.type === 'call';
}

function taskStatusText(task: AlertTask) {
  if (isDisplayOnlySwpCall(task))
    return '呼叫中';
  if (task.status !== 'handling')
    return '待处理';
  return '处理中';
}

const envTemp = computed(() => {
  for (const room of area.value?.rooms ?? []) {
    const temp = room.doorEnvData?.temp;
    if (temp != null && String(temp).trim())
      return String(temp).replace(/℃|°C/g, '').trim();
  }
  return undefined;
});

const keyMetrics = computed(() => {
  if (!area.value)
    return [];

  let totalBeds = 0;
  let occupied = 0;
  let onlineDevices = 0;

  for (const room of area.value.rooms) {
    const stats = getWardBedStats(room);
    totalBeds += stats.total;
    occupied += stats.occupied;
    if (room.isOnline === true)
      onlineDevices++;
    for (const bed of room.beds) {
      if (bed.isOnline)
        onlineDevices++;
    }
  }

  const rows = [];
  const bedNum = hospitalInfo.value?.bedNum ?? totalBeds;
  if (bedNum > 0)
    rows.push({ key: 'bed', label: '开放床位', value: bedNum, unit: '张' });
  if (envTemp.value)
    rows.push({ key: 'temp', label: '室内温度', value: envTemp.value, unit: '℃' });
  if (area.value.rooms.length > 0)
    rows.push({ key: 'rooms', label: '病房数量', value: area.value.rooms.length, unit: '间' });
  if (onlineDevices > 0)
    rows.push({ key: 'device', label: '在线设备', value: onlineDevices, unit: '台' });
  if (occupied > 0)
    rows.push({ key: 'patient', label: '在院患者', value: occupied, unit: '人' });
  if (totalBeds > 0) {
    const rate = Math.round((occupied / totalBeds) * 100);
    rows.push({ key: 'rate', label: '入住率', value: rate, unit: '%' });
  }
  return rows;
});

function alertSeverityLabel(severity: 'critical' | 'high' | 'medium') {
  if (severity === 'critical')
    return '紧急';
  if (severity === 'high')
    return '重要';
  return '提醒';
}

function alertTypeLabel(type: AlertTask['type']) {
  if (type === 'call')
    return '床位呼叫';
  if (type === 'env')
    return '环境异常';
  if (type === 'offline')
    return '设备巡检';
  if (type === 'inspection')
    return '巡视超时';
  return '输液巡视';
}

function handleSceneTypeChange(type: typeof sceneType.value) {
  const feedback = resolveSceneSwitchFeedback(sceneType.value, type);
  if (sceneSwitchTimer) {
    window.clearTimeout(sceneSwitchTimer);
    sceneSwitchTimer = null;
  }
  sceneSwitchFeedback.value = feedback;
  store.setSceneType(type);
  if (feedback) {
    sceneSwitchTimer = window.setTimeout(() => {
      sceneSwitchFeedback.value = null;
      sceneSwitchTimer = null;
    }, feedback.durationMs);
  }
}

async function handleAreaSwitch(areaId: number) {
  const success = await store.switchArea(areaId);
  if (success)
    isAreaSwitcherOpen.value = false;
}

function setBootProgress(value: number, phase: string) {
  bootPhase.value = phase;
  bootTargetProgress.value = Math.max(bootTargetProgress.value, Math.min(100, value));
}

function startBootProgress() {
  bootStartedAt = Date.now();
  bootProgress.value = 0;
  bootTargetProgress.value = 0;
  if (bootTimer)
    clearInterval(bootTimer);
  bootTimer = setInterval(() => {
    if (bootProgress.value >= bootTargetProgress.value)
      return;
    const gap = bootTargetProgress.value - bootProgress.value;
    const step = bootTargetProgress.value === 100
      ? 3.2
      : gap > 18 ? 3.4 : gap > 7 ? 2.2 : 1.05;
    bootProgress.value = Math.min(bootTargetProgress.value, bootProgress.value + step);
  }, 56);
}

async function loadAreaSelectionContext() {
  const useRemoteDeviceApi = store.dataSource === 'remote';
  const useAreaSelection = useRemoteDeviceApi || store.dataSource === 'database';
  if (useRemoteDeviceApi) {
    getCacheInfo.init();
    clearAreaDiscoveryCache();
  }
  bootError.value = await prepareAreaSelection({
    useRemoteDeviceApi,
    useAreaSelection,
    assertRuntimeConfigured: assertDeviceRuntimeConfigured,
    initializeFilePrefix: useRemoteDeviceApi ? initFileUrlPrefix : async () => {},
    loadAreaOptions: store.loadAreaOptions,
    loadLocalArea: async () => {
      await store.loadArea();
      if (!store.error && store.dataSource === 'mock')
        store.startSimulation();
      return store.error;
    },
    getRememberedAreaId: () => store.rememberedAreaId,
    enterRememberedArea: areaId => store.enterArea(areaId),
    onPhase: setBootProgress,
  });
}

async function retryAreaSelection() {
  isBootRetrying.value = true;
  try {
    await loadAreaSelectionContext();
  }
  catch (error) {
    bootError.value = error instanceof Error ? error.message : '初始化失败';
  }
  finally {
    isBootRetrying.value = false;
  }
}

function finishBootProgress(generation: number) {
  const finishDelay = Math.max(0, MIN_STARTUP_DURATION - (Date.now() - bootStartedAt));
  window.setTimeout(() => {
    if (generation !== bootGeneration)
      return;
    bootPhase.value = '场景装配完成';
    bootTargetProgress.value = 100;
  }, finishDelay);
  const waitForComplete = window.setInterval(() => {
    if (generation !== bootGeneration) {
      window.clearInterval(waitForComplete);
      return;
    }
    if (Math.round(bootProgress.value) < 100)
      return;
    window.clearInterval(waitForComplete);
    bootProgress.value = 100;
    window.setTimeout(() => {
      if (bootTimer) {
        clearInterval(bootTimer);
        bootTimer = null;
      }
      showStartupLoader.value = false;
    }, 260);
  }, 80);
}

async function bootstrapDigitalTwin() {
  if (hasBootstrapped)
    return;
  hasBootstrapped = true;
  const generation = ++bootGeneration;
  showStartupLoader.value = true;
  startBootProgress();
  setBootProgress(4, '初始化智慧病房资源');
  try {
    await loadAreaSelectionContext();
  }
  catch (error) {
    bootError.value = error instanceof Error ? error.message : '初始化失败';
  }
  if (generation !== bootGeneration || !authSession.value)
    return;
  setBootProgress(86, '准备病区工作台');
  finishBootProgress(generation);
}

function cancelBootstrap() {
  bootGeneration += 1;
  if (bootTimer) {
    clearInterval(bootTimer);
    bootTimer = null;
  }
  hasBootstrapped = false;
  showStartupLoader.value = false;
}

function handleAuthenticated(session: AuthSession) {
  authSession.value = session;
  store.setAlertOperator(session.user.userRealname || session.user.userName);
  authNotice.value = '';
  void bootstrapDigitalTwin();
}

function handleAuthExpired(event: Event) {
  const message = event instanceof CustomEvent && typeof event.detail?.message === 'string'
    ? event.detail.message
    : '登录已过期，请重新登录';
  store.clearSessionState();
  authSession.value = null;
  authNotice.value = message;
  cancelBootstrap();
}

function handleLogout() {
  clearAuthSession();
  store.clearSessionState();
  authSession.value = null;
  authNotice.value = '';
  cancelBootstrap();
}

function handleStorage(event: StorageEvent) {
  if (event.key === ALERT_ACK_STORAGE_KEY)
    store.reloadAlertAckRecords();
  if (event.key === SWP_CALL_ALERTS_STORAGE_KEY)
    store.reloadCallAlertsEnabled();
}

onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  window.addEventListener('storage', handleStorage);
  if (authSession.value)
    store.setAlertOperator(authSession.value.user.userRealname || authSession.value.user.userName);
  dataStatusTimer = window.setInterval(() => { dataStatusNow.value = Date.now(); }, 30_000);
  if (authSession.value)
    void bootstrapDigitalTwin();
});

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  window.removeEventListener('storage', handleStorage);
  if (dataStatusTimer)
    window.clearInterval(dataStatusTimer);
});
</script>



<template>
  <SwpLoginGate
    v-if="!authSession"
    :notice="authNotice"
    @authenticated="handleAuthenticated"
  />

  <div v-else class="digital-twin">
    <Transition name="startup-fade">
      <StartupLoader
        v-if="showStartupLoader"
        :progress="bootProgress"
        :phase="bootPhase"
      />
    </Transition>

    <AreaSelectionView
      v-if="!area"
      :areas="areaOptions"
      :preferred-area-id="preferredAreaId"
      :remembered-area-id="rememberedAreaId"
      :is-list-loading="isAreaListLoading || isBootRetrying"
      :is-entering="isAreaSwitching"
      :pending-area-id="pendingAreaId"
      :error="bootError || areaSwitchError || areaListError"
      @enter="store.enterArea"
      @retry="retryAreaSelection"
    />

    <div
      v-else
      class="digital-twin__main"
      :class="{
        'digital-twin__main--station': isNurseStation,
        'digital-twin__main--ward': isWard || isWardInterior,
        'digital-twin__main--interior': isWardInterior,
        'digital-twin__main--plan': isWardInterior && wardInteriorView === 'plan',
        'digital-twin__main--panels-hidden': !panelsVisible,
        'digital-twin__main--scene-switching': !!sceneSwitchFeedback,
      }"
    >
      <DashboardHeader
        :area-name="area.areaName"
        :dept-name="area.deptName"
        :env-temp="envTemp"
        :is-loading="isLoading"
        :can-switch-area="areaOptions.length > 1"
        :is-area-switching="isAreaSwitching"
        :data-source="dataSource"
        :data-status="dataStatus"
        :operator-name="authSession.user.userRealname || authSession.user.userName"
        :operator-role="authSession.role.roleName"
        @refresh="store.reset()"
        @open-area-switch="isAreaSwitcherOpen = true"
        @logout="handleLogout"
      />

      <AreaSwitcher
        v-if="area && selectedAreaId != null"
        :open="isAreaSwitcherOpen"
        :areas="areaOptions"
        :current-area-id="selectedAreaId"
        :pending-area-id="pendingAreaId"
        :switching="isAreaSwitching"
        :error="areaSwitchError"
        @close="isAreaSwitcherOpen = false"
        @switch="handleAreaSwitch"
      />

      <button
        v-if="isNurseStation || isWard || isWardInterior"
        type="button"
        class="digital-twin__panel-toggle"
        :class="{
          'digital-twin__panel-toggle--hidden': !panelsVisible,
          'digital-twin__panel-toggle--plan': isWardInterior && wardInteriorView === 'plan',
        }"
        :aria-label="panelsVisible ? '隐藏所有信息面板' : '显示所有信息面板'"
        :aria-pressed="!panelsVisible"
        @click="panelsVisible = !panelsVisible"
      >
        <span class="digital-twin__panel-toggle-icon" aria-hidden="true"><i /></span>
        <span>{{ panelsVisible ? '隐藏面板' : '显示面板' }}</span>
      </button>

      <div class="digital-twin__scene">
        <DashboardLeftPanel v-if="panelsVisible" :area="area" />

        <DashboardAreaNav
          v-if="isWard && panelsVisible"
          :rooms="area.rooms"
          :room-summaries="roomSummaries"
          :focused-room-index="currentRoomIndex"
          @focus-room="store.focusRoom"
          @enter-room="store.enterRoom"
        />

        <EnvAlertBanner
          v-if="isWardInterior && currentWard && panelsVisible"
          class="digital-twin__env-banner"
          :alert="currentEnvAlert"
        />

        <div
          v-if="activeAlertTask && !isNurseStation && panelsVisible"
          class="digital-twin__locate-banner"
          :class="[
            `digital-twin__locate-banner--${activeAlertTask.severity}`,
            { 'digital-twin__locate-banner--handling': activeAlertTask.status === 'handling' },
          ]"
        >
          <div class="digital-twin__locate-main">
            <span class="digital-twin__locate-label">已定位</span>
            <strong>
              {{ activeAlertTask.roomName }}
              <template v-if="activeAlertTask.bedName"> · {{ formatBedLabel(activeAlertTask.bedName) }}</template>
            </strong>
            <p>
              <span>{{ alertTypeLabel(activeAlertTask.type) }}</span>
              {{ activeAlertTask.description }}
            </p>
          </div>
          <div class="digital-twin__locate-actions">
            <span class="digital-twin__locate-status">
              {{ alertSeverityLabel(activeAlertTask.severity) }} · {{ taskStatusText(activeAlertTask) }}
            </span>
            <button
              v-if="canMarkHandling(activeAlertTask)"
              type="button"
              @click="store.markAlertHandling(activeAlertTask.id)"
            >
              {{ handlingActionText() }}
            </button>
            <span v-if="!isDisplayOnlySwpCall(activeAlertTask) && activeAlertTask.status === 'handling'">
              等待状态恢复后自动结束
            </span>
          </div>
        </div>

        <div
          v-if="alertLocateNotice"
          class="digital-twin__locate-notice"
          role="status"
          aria-live="polite"
        >
          {{ alertLocateNotice }}
        </div>

        <div
          v-if="isWardInterior && (bedDetailsLoading || bedDetailsError)"
          class="digital-twin__bed-device-state"
          :class="{ 'digital-twin__bed-device-state--error': bedDetailsError }"
          role="status"
          aria-live="polite"
        >
          <span class="digital-twin__bed-device-dot" aria-hidden="true" />
          <span>{{ bedDetailsLoading ? '正在加载床头屏信息' : bedDetailsError }}</span>
        </div>

        <WardLegend v-if="(isWard || isWardInterior) && panelsVisible" />

        <NurseStationVisualScene
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !stationSceneActive }"
          :area="area"
          :room-summaries="roomSummaries"
          :device-count="deviceCodes.length"
          :overlays-visible="panelsVisible"
          :model-state="stationModelState"
          :active="stationSceneActive"
          @room-click="store.enterRoom"
          @model-state="stationModelState = $event"
        />

        <AreaScene3D
          v-if="area"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !corridorSceneActive }"
          :key="buildAreaSceneIdentity(selectedAreaId)"
          :area-id="selectedAreaId"
          :area="area"
          :room-summaries="roomSummaries"
          :focused-room-index="currentRoomIndex"
          :configured-device-count="deviceCodes.length"
          scene-type="ward"
          model-kind="corridor"
          :active="corridorSceneActive"
          @room-click="store.enterRoom"
          @focus-room="store.focusRoom"
        />

        <WardScene3D
          v-if="preloadedWard"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !interiorSceneActive }"
          :ward="preloadedWard"
          :camera-preset="cameraPreset"
          :env-alert-level="currentEnvAlert.level"
          :selected-bed-code="selectedBed?.bedCode ?? null"
          :active="interiorSceneActive"
          @bed-click="store.selectBed"
        />
        <WardPlanView
          v-if="isWardInterior && currentWard && wardInteriorView !== '3d'"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': wardInteriorView !== 'plan' }"
          :ward="currentWard"
          :selected-bed="selectedBed"
          @bed-click="store.selectBed"
        />

        <WardPlanBedDialog
          v-if="isWardInterior && wardInteriorView === 'plan' && selectedBed"
          :bed="selectedBed"
          @close="store.clearSelection"
        />

      </div>

      <DashboardBottomNav
        :scene-type="sceneType"
        :ward-interior-view="wardInteriorView"
        :is-simulating="isSimulating"
        :data-source="dataSource"
        :compact="isNurseStation"
        @set-scene-type="handleSceneTypeChange"
        @set-ward-interior-view="store.setWardInteriorView"
        @toggle-simulation="store.toggleSimulation()"
      />

      <SceneSwitchLoader :feedback="sceneSwitchFeedback" />

      <aside
        v-show="panelsVisible"
        class="digital-twin__panel"
        :class="{
          'digital-twin__panel--station': isNurseStation,
          'digital-twin__panel--overlay': !isNurseStation,
          'digital-twin__panel--interior': isWardInterior,
        }"
      >
        <template v-if="isNurseStation">
          <NurseStationPanel
            :area="area"
            :room-summaries="roomSummaries"
            :status-history="statusHistory"
            :device-count="deviceCodes.length"
            :alert-tasks="alertTasks"
            :hidden-alert-tasks="hiddenAlertTasks"
            :alert-ack-records="alertAckRecords"
            :call-alerts-enabled="callAlertsEnabled"
            :swp-events="swpEvents"
            :swp-response-metrics="swpResponseMetrics"
            :swp-event-sync="swpEventSync"
            :swp-response-sync="swpResponseSync"
            :inspection-room-summaries="inspectionRoomSummaries"
            :inspection-sync="inspectionSync"
            :ward-data-status="dataStatus"
            @focus-room="store.focusRoom"
            @locate-alert="store.openAlertTask"
            @mark-alert-handling="store.markAlertHandling"
            @restore-alert="store.restoreAlertTask"
            @set-call-alerts-enabled="store.setCallAlertsEnabled"
          />
        </template>

        <template v-else>
          <HospitalIntroPanel
            v-if="isWard"
            :info="hospitalInfo"
            :loading="hospitalInfoLoading"
            :key-metrics="keyMetrics"
          />

          <div class="digital-twin__panel-body">
            <AreaInfoPanel
              v-if="isWard"
              :area="area"
              :room-summaries="roomSummaries"
              :status-history="statusHistory"
              :focused-room-index="currentRoomIndex"
              :show-back-to-station="true"
              :alert-tasks="alertTasks"
              :alert-ack-records="alertAckRecords"
              :inspection-room-summaries="inspectionRoomSummaries"
              @focus-room="store.focusRoom"
              @enter-room="store.enterRoom"
              @back-to-station="handleSceneTypeChange('nurse-station')"
              @locate-alert="store.openAlertTask"
              @mark-alert-handling="store.markAlertHandling"
            />

            <WardInfoPanel
              v-else-if="isWardInterior && currentWard"
              :area="area"
              :ward="currentWard"
              :selected-bed="selectedBed"
              :selected-status="selectedStatus"
              :env-alert="currentEnvAlert"
              :status-history="statusHistory"
              :active-alert-task="activeAlertTask"
              :inspection-summary="currentInspectionSummary"
              @close="store.clearSelection"
              @mark-alert-handling="store.markAlertHandling"
            />
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>



<style scoped lang="scss">

@keyframes digital-panel-enter {
  0% {
    opacity: 0;
    transform: translate3d(22px, 0, 0);
  }

  65% {
    opacity: 0.96;
    transform: translate3d(-2px, 0, 0);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes digital-panel-scan {
  0%,
  10% {
    opacity: 0;
    transform: translate3d(0, -125%, 0);
  }

  26% {
    opacity: 0.72;
  }

  52% {
    opacity: 0.42;
  }

  84%,
  100% {
    opacity: 0;
    transform: translate3d(0, 325%, 0);
  }
}

@keyframes digital-panel-edge-pulse {
  0%,
  100% {
    opacity: 0.68;
    box-shadow:
      0 0 12px rgba(64, 214, 255, 0.28),
      0 0 24px rgba(64, 214, 255, 0.1);
  }

  50% {
    opacity: 1;
    box-shadow:
      0 0 26px rgba(64, 214, 255, 0.58),
      0 0 52px rgba(64, 214, 255, 0.22);
  }
}

@keyframes digital-panel-grid-drift {
  0% {
    background-position: 0 0, 0 0, 0 0, 0 0, 0 0;
  }

  100% {
    background-position: 0 0, 0 0, 48px 24px, -24px 48px, 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .digital-twin__panel,
  .digital-twin__panel::before,
  .digital-twin__panel::after {
    animation: none;
  }
}

.startup-fade-enter-active,
.startup-fade-leave-active {
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.startup-fade-enter-from,
.startup-fade-leave-to {
  opacity: 0;
  filter: blur(8px);
}

.digital-twin {

  position: relative;

  display: flex;

  flex-direction: column;

  width: 100%;

  height: 100%;

  min-height: 100svh;

  min-height: 100dvh;

  background: #060e1a;

  color: #e0e6ed;

  overflow: hidden;

  --mobile-panel-height: min(45vh, 520px);
  --mobile-control-gap: calc(12px + env(safe-area-inset-bottom));



  &__env-banner {
    position: absolute;
    top: 72px;
    left: 220px;
    right: 500px;

    z-index: 25;

    pointer-events: none;



    :deep(.env-alert-banner) {

      margin: 0;

      backdrop-filter: blur(8px);

    }



    @include down($bp-md) {

      right: 16px;

      top: 56px;

    }

  }

  &__bed-device-state {
    position: absolute;
    z-index: 24;
    top: 76px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(520px, calc(100% - 32px));
    min-height: 34px;
    padding: 7px 13px;
    color: #dffaf7;
    font-size: 13px;
    background: rgba(8, 37, 43, 0.9);
    border: 1px solid rgba(124, 223, 210, 0.38);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(2, 18, 22, 0.24);
    transform: translateX(-50%);

    &--error {
      color: #ffe9df;
      background: rgba(74, 32, 27, 0.92);
      border-color: rgba(255, 151, 125, 0.52);
    }
  }

  &__bed-device-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    background: #6de3d1;
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(109, 227, 209, 0.12);
  }

  &__bed-device-state--error &__bed-device-dot {
    background: #ff9579;
    box-shadow: 0 0 0 4px rgba(255, 149, 121, 0.12);
  }

  &__locate-banner {
    position: absolute;
    top: 84px;
    left: clamp(18px, 3vw, 42px);
    right: clamp(18px, 3vw, 42px);
    z-index: 28;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid rgba(255, 183, 77, 0.42);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(30, 14, 18, 0.72), rgba(6, 22, 38, 0.72));
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26), inset 3px 0 0 rgba(255, 183, 77, 0.9);
    backdrop-filter: blur(10px);
    pointer-events: auto;

    &--critical {
      border-color: rgba(255, 82, 82, 0.5);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26), inset 3px 0 0 rgba(255, 82, 82, 0.95);
    }

    &--medium {
      border-color: rgba(77, 208, 255, 0.34);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26), inset 3px 0 0 rgba(77, 208, 255, 0.78);
    }

    &--handling {
      background: linear-gradient(135deg, rgba(12, 40, 52, 0.78), rgba(6, 22, 38, 0.76));
    }

    @include down($bp-md) {
      top: 58px;
      grid-template-columns: 1fr;
      gap: 10px;
      right: 16px;
      left: 16px;
      padding: 10px;
    }
  }

  &__locate-main {
    min-width: 0;

    strong {
      display: block;
      margin-top: 5px;
      color: #fff;
      font-size: 17px;
      line-height: 1.2;
    }

    p {
      margin: 6px 0 0;
      color: rgba(224, 240, 250, 0.88);
      font-size: 12px;
      line-height: 1.45;

      span {
        display: inline-flex;
        margin-right: 7px;
        padding: 1px 6px;
        border-radius: 999px;
        background: rgba(77, 208, 255, 0.16);
        color: #9be8ff;
        font-size: 10px;
        font-weight: 800;
      }
    }
  }

  &__locate-label,
  &__locate-status {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 900;
  }

  &__locate-label {
    padding: 2px 8px;
    color: #061522;
    background: #9be8ff;
  }

  &__locate-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;

    > span:not(.digital-twin__locate-status) {
      max-width: 126px;
      color: rgba(188, 226, 239, 0.82);
      font-size: 10px;
      font-weight: 750;
      line-height: 1.35;
      text-align: right;
    }

    button {
      min-height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(129, 212, 250, 0.38);
      border-radius: 7px;
      background: rgba(14, 48, 78, 0.72);
      color: #e8f9ff;
      font-family: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;

      &:hover {
        border-color: rgba(129, 212, 250, 0.75);
        background: rgba(25, 118, 210, 0.56);
      }
    }

    @include down($bp-md) {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }

  &__locate-status {
    padding: 4px 8px;
    color: rgba(226, 244, 255, 0.86);
    background: rgba(255, 255, 255, 0.08);
  }

  &__locate-notice {
    position: absolute;
    top: 84px;
    left: 50%;
    z-index: 34;
    max-width: min(420px, calc(100vw - 32px));
    padding: 9px 13px;
    border: 1px solid rgba(255, 190, 90, 0.42);
    border-radius: 8px;
    background: rgba(52, 34, 18, 0.92);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
    color: #ffe0a5;
    font-size: 12px;
    font-weight: 750;
    transform: translateX(-50%);
    pointer-events: none;
  }

  &__main {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    &--scene-switching {
      :deep(.dash-bottom) {
        pointer-events: none;
      }

      > .digital-twin__panel-toggle {
        opacity: 0.48;
        pointer-events: none;
      }
    }

    &--station {
      --scene-panel-width: clamp(340px, 26vw, 460px);
      --mobile-panel-height: min(42vh, 500px);
    }

    &--ward {
      --scene-panel-width: clamp(340px, 24vw, 430px);

      @include up($bp-xl) {
        --scene-panel-width: 430px;
      }

      @include between($bp-md, $bp-lg) {
        --scene-panel-width: clamp(320px, 31vw, 380px);
      }
    }
  }

  &__panel-toggle {
    position: absolute;
    right: calc(var(--scene-panel-width, 460px) + 10px);
    bottom: 10px;
    z-index: 32;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 11px 0 9px;
    border: 1px solid rgba(157, 245, 235, 0.24);
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(12, 58, 68, 0.52), rgba(6, 31, 45, 0.62));
    box-shadow:
      0 8px 18px rgba(0, 18, 26, 0.18),
      0 0 0 1px rgba(255, 255, 255, 0.025) inset,
      inset 0 0 10px rgba(170, 255, 246, 0.045);
    color: rgba(234, 255, 253, 0.9);
    font: 800 11px/1 inherit;
    letter-spacing: 0;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: right 180ms ease, bottom 180ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease;

    &:hover {
      border-color: rgba(215, 255, 249, 0.62);
      background: linear-gradient(180deg, rgba(17, 81, 94, 0.68), rgba(7, 42, 58, 0.78));
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 3px;
    }

    &--hidden {
      background: linear-gradient(180deg, rgba(13, 69, 82, 0.64), rgba(6, 37, 52, 0.76));
    }

    &--plan {
      right: 22px;
      bottom: 20px;
      min-height: 30px;
      padding: 0 10px 0 8px;
      opacity: 0.78;
      border-color: rgba(91, 219, 255, 0.24);
      background: linear-gradient(180deg, rgba(8, 36, 58, 0.34), rgba(4, 18, 34, 0.46));
      box-shadow:
        0 0 18px rgba(77, 208, 255, 0.16),
        inset 0 0 14px rgba(77, 208, 255, 0.06);

      &:hover {
        opacity: 1;
        border-color: rgba(91, 219, 255, 0.58);
      }
    }

    @include down($bp-md) {
      right: 12px;
      bottom: calc(var(--mobile-panel-height) + 88px + env(safe-area-inset-bottom));
      min-height: 36px;
      padding: 0 12px 0 10px;
    }
  }

  &__main--interior &__panel-toggle {
    bottom: 15px;

    @include down($bp-md) {
      bottom: calc(var(--mobile-panel-height) + 88px + env(safe-area-inset-bottom));
    }
  }

  &__main--plan &__panel-toggle {
    right: 22px;
    bottom: 20px;
  }

  &__panel-toggle-icon {
    position: relative;
    display: block;
    width: 18px;
    height: 11px;
    border: 1.5px solid currentColor;
    border-radius: 50% / 62%;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 24px;
      height: 1.5px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 2px rgba(12, 58, 68, 0.86);
      transform: translate(-50%, -50%) rotate(-42deg) scaleX(0);
      transition: transform 160ms ease;
    }

    i {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      transform: translate(-50%, -50%);
    }
  }

  &__panel-toggle--hidden &__panel-toggle-icon::after {
    transform: translate(-50%, -50%) rotate(-42deg) scaleX(1);
  }

  &__main--panels-hidden &__panel-toggle {
    right: 18px;

    @include down($bp-md) {
      right: 12px;
    }
  }

  &__main--station &__scene {
    right: 0;

    @include down($bp-md) {
      right: 0;
    }
  }

  &__main--station:not(&__main--panels-hidden) :deep(.dash-bottom) {
    transform: translateX(-50%) scale(0.9);
    transform-origin: 50% 100%;
    opacity: 0.9;

    @include down($bp-md) {
      bottom: calc(var(--mobile-panel-height) + 10px + env(safe-area-inset-bottom));
    }
  }

  &__main--station &__panel-toggle:not(&__panel-toggle--hidden) {
    right: calc(var(--scene-panel-width, 420px) + 16px);
    bottom: 15px;

    @include down($bp-md) {
      bottom: calc(var(--mobile-panel-height) + 100px + env(safe-area-inset-bottom));
      min-height: 34px;
      padding: 0 10px;
    }
  }

  &__main--ward:not(&__main--panels-hidden) :deep(.dash-bottom),
  &__main--interior:not(&__main--panels-hidden) :deep(.dash-bottom) {
    @include down($bp-md) {
      bottom: calc(var(--mobile-panel-height) + 10px + env(safe-area-inset-bottom));
    }
  }

  &__main--panels-hidden :deep(.dash-bottom) {
    @include down($bp-md) {
      bottom: calc(10px + env(safe-area-inset-bottom));
    }
  }

  &__main--panels-hidden &__panel-toggle {
    @include down($bp-md) {
      bottom: calc(14px + env(safe-area-inset-bottom));
    }
  }

  &__main--ward &__scene {
    right: 0;
  }

  &__main--panels-hidden &__scene {
    right: 0;
  }



  &__scene {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
  }

  &__scene-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    transition: opacity 0.42s ease;

    &--inactive {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
  }



  &__panel {
    --panel-border: rgba(98, 214, 255, 0.2);
    --panel-line: rgba(98, 214, 255, 0.1);
    --panel-surface: rgba(6, 18, 32, 0.26);
    --panel-surface-soft: rgba(8, 24, 42, 0.2);
    --panel-glass-alpha: 0.42;
    --panel-line-top: 58px;

    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    width: 460px;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    overflow: hidden;
    padding-top: 58px;
    isolation: isolate;
    background:
      linear-gradient(
        180deg,
        rgba(9, 31, 52, 0.6) 0%,
        rgba(5, 20, 36, 0.46) 48%,
        rgba(3, 13, 26, 0.34) 100%
      ),
      linear-gradient(120deg, rgba(71, 218, 255, 0.08), transparent 42%),
      repeating-linear-gradient(
        90deg,
        rgba(98, 214, 255, 0.026) 0,
        rgba(98, 214, 255, 0.026) 1px,
        transparent 1px,
        transparent 48px
      ),
      repeating-linear-gradient(
        0deg,
        rgba(98, 214, 255, 0.018) 0,
        rgba(98, 214, 255, 0.018) 1px,
        transparent 1px,
        transparent 48px
      ),
      rgba(6, 18, 32, var(--panel-glass-alpha));
    border-left: 1px solid var(--panel-border);
    box-shadow:
      -18px 0 42px rgba(0, 0, 0, 0.24),
      -1px 0 18px rgba(40, 204, 245, 0.08),
      inset 1px 0 0 rgba(176, 243, 255, 0.08),
      inset -1px 0 0 rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(16px) saturate(135%);
    -webkit-backdrop-filter: blur(16px) saturate(135%);
    will-change: background-position;
    animation:
      digital-panel-enter 0.52s cubic-bezier(0.22, 0.8, 0.24, 1) both,
      digital-panel-grid-drift 12s linear 0.52s infinite;

    &::before {
      content: '';
      position: absolute;
      top: var(--panel-line-top);
      left: 0;
      right: 0;
      height: 1px;
      z-index: 2;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(87, 224, 255, 0.18) 8%,
        rgba(87, 224, 255, 0.82) 46%,
        rgba(87, 224, 255, 0.22) 86%,
        transparent 100%
      );
      box-shadow: 0 0 16px rgba(64, 214, 255, 0.3);
      pointer-events: none;
      will-change: opacity, box-shadow;
      animation: digital-panel-edge-pulse 3.8s ease-in-out infinite;
    }

    &::after {
      content: '';
      position: absolute;
      top: var(--panel-line-top);
      left: 0;
      right: 0;
      height: 34%;
      z-index: 2;
      pointer-events: none;
      background:
        linear-gradient(
          180deg,
          transparent 0%,
          rgba(83, 222, 255, 0.12) 22%,
          rgba(83, 222, 255, 0.34) 42%,
          rgba(83, 222, 255, 0.56) 50%,
          rgba(83, 222, 255, 0.34) 58%,
          rgba(83, 222, 255, 0.12) 78%,
          transparent 100%
        ),
        linear-gradient(
          90deg,
          transparent 0%,
          rgba(130, 237, 255, 0.16) 50%,
          transparent 100%
        );
      mix-blend-mode: screen;
      filter: blur(0.6px) saturate(125%);
      opacity: 0;
      will-change: transform, opacity;
      animation: digital-panel-scan 5.4s ease-in-out 0.2s infinite;
    }

    &--station {
      width: var(--scene-panel-width, 300px);
      padding-top: 42px;
      --panel-glass-alpha: 0.38;
      --panel-line-top: 42px;
      background:
        linear-gradient(
          180deg,
          rgba(8, 28, 47, 0.56) 0%,
          rgba(5, 19, 34, 0.4) 52%,
          rgba(3, 13, 25, 0.3) 100%
        ),
        linear-gradient(120deg, rgba(71, 218, 255, 0.07), transparent 45%),
        repeating-linear-gradient(
          90deg,
          rgba(98, 214, 255, 0.022) 0,
          rgba(98, 214, 255, 0.022) 1px,
          transparent 1px,
          transparent 48px
        ),
        repeating-linear-gradient(
          0deg,
          rgba(98, 214, 255, 0.015) 0,
          rgba(98, 214, 255, 0.015) 1px,
          transparent 1px,
          transparent 48px
        ),
        rgba(6, 18, 32, var(--panel-glass-alpha));
      border-left-color: rgba(77, 208, 255, 0.28);
      box-shadow:
        -14px 0 34px rgba(0, 0, 0, 0.22),
        -1px 0 18px rgba(40, 204, 245, 0.07),
        inset 1px 0 0 rgba(176, 243, 255, 0.06),
        inset -1px 0 0 rgba(0, 0, 0, 0.1);

      @include down($bp-md) {
        width: 100%;
        max-height: var(--mobile-panel-height);
        background:
          linear-gradient(180deg, rgba(8, 28, 47, 0.58), rgba(4, 15, 28, 0.42)),
          rgba(6, 18, 32, var(--panel-glass-alpha));
      }
    }

    &--overlay {
      width: var(--scene-panel-width, 400px);
      --panel-glass-alpha: 0.46;
      border-left-color: rgba(89, 222, 255, 0.34);

      &::before {
        background: linear-gradient(
          90deg,
          rgba(83, 222, 255, 0.88),
          rgba(83, 222, 255, 0.3) 58%,
          transparent
        );
        box-shadow: 0 0 12px rgba(64, 214, 255, 0.3);
      }
    }

    &--interior {
      --panel-glass-alpha: 0.54;
      --panel-line-top: 54px;
      background:
        linear-gradient(
          165deg,
          rgba(11, 49, 73, 0.78) 0%,
          rgba(5, 24, 43, 0.62) 45%,
          rgba(4, 15, 29, 0.52) 100%
        ),
        linear-gradient(110deg, rgba(68, 229, 255, 0.13), transparent 38%),
        repeating-linear-gradient(
          90deg,
          rgba(119, 231, 255, 0.032) 0,
          rgba(119, 231, 255, 0.032) 1px,
          transparent 1px,
          transparent 42px
        ),
        repeating-linear-gradient(
          0deg,
          rgba(119, 231, 255, 0.022) 0,
          rgba(119, 231, 255, 0.022) 1px,
          transparent 1px,
          transparent 42px
        ),
        rgba(6, 18, 32, var(--panel-glass-alpha));
      border-left-color: rgba(83, 222, 255, 0.5);
      box-shadow:
        -24px 0 54px rgba(0, 0, 0, 0.3),
        -2px 0 26px rgba(64, 214, 255, 0.16),
        inset 2px 0 0 rgba(176, 243, 255, 0.13),
        inset -1px 0 0 rgba(0, 0, 0, 0.16);

      &::before {
        height: 2px;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(97, 235, 255, 0.52) 8%,
          rgba(158, 247, 255, 1) 46%,
          rgba(79, 211, 255, 0.42) 84%,
          transparent 100%
        );
        box-shadow:
          0 0 18px rgba(64, 214, 255, 0.58),
          0 0 42px rgba(64, 214, 255, 0.2);
      }

      &::after {
        height: 46%;
        background:
          linear-gradient(
            180deg,
            transparent 0%,
            rgba(83, 222, 255, 0.16) 20%,
            rgba(83, 222, 255, 0.46) 46%,
            rgba(161, 246, 255, 0.7) 50%,
            rgba(83, 222, 255, 0.46) 54%,
            rgba(83, 222, 255, 0.16) 80%,
            transparent 100%
          ),
          linear-gradient(90deg, transparent, rgba(130, 237, 255, 0.2) 50%, transparent);
        filter: blur(0.4px) saturate(145%);
      }

      :deep(.hospital-intro) {
        position: relative;
        margin: 0 14px 12px;
        padding: 16px 16px 15px;
        overflow: hidden;
        background:
          linear-gradient(145deg, rgba(12, 49, 74, 0.52), rgba(5, 23, 41, 0.34)),
          rgba(7, 22, 39, 0.28);
        border: 1px solid rgba(83, 222, 255, 0.24);
        border-radius: 12px;
        box-shadow:
          0 12px 28px rgba(0, 0, 0, 0.14),
          inset 0 1px 0 rgba(193, 247, 255, 0.1),
          inset 3px 0 0 rgba(77, 224, 255, 0.52);
      }

      :deep(.hospital-intro)::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 44%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(153, 246, 255, 0.82));
        box-shadow: 0 0 14px rgba(83, 222, 255, 0.42);
      }

      :deep(.hospital-intro__title) {
        color: #effcff;
        text-shadow: 0 0 14px rgba(77, 224, 255, 0.38);
      }

      :deep(.hospital-intro__note) {
        color: rgba(226, 245, 255, 0.9);
        text-shadow: 0 0 8px rgba(62, 167, 206, 0.14);
      }

      :deep(.hospital-intro__metric) {
        background:
          linear-gradient(135deg, rgba(8, 40, 63, 0.7), rgba(7, 25, 44, 0.46)),
          rgba(6, 22, 40, 0.42);
        border-color: rgba(83, 222, 255, 0.26);
        box-shadow:
          inset 0 1px 0 rgba(187, 246, 255, 0.08),
          0 0 0 1px rgba(30, 139, 178, 0.08);
        transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
      }

      :deep(.hospital-intro__metric:hover) {
        border-color: rgba(131, 237, 255, 0.58);
        box-shadow:
          inset 0 1px 0 rgba(187, 246, 255, 0.14),
          0 0 18px rgba(55, 206, 255, 0.16);
        transform: translateY(-1px);
      }

      :deep(.hospital-intro__metric-value) {
        text-shadow: 0 0 14px rgba(77, 224, 255, 0.44);
      }

      :deep(.hospital-intro__footer) {
        border-top-color: rgba(83, 222, 255, 0.2);
      }
    }



    @include up($bp-xl) {
      width: var(--scene-panel-width, 430px);

    }



    @include between($bp-md, $bp-lg) {
      width: var(--scene-panel-width, 360px);

    }



    @include down($bp-md) {

      top: auto;

      left: 0;

      right: 0;

      bottom: 0;

      width: 100%;

      max-height: var(--mobile-panel-height);

      padding-top: 0;

      border-top: 1px solid var(--panel-border);
      border-left: none;

      &::before {
        display: none;
      }

      &::after {
        top: 0;
        height: 42%;
      }

    }



    > :deep(*) {
      position: relative;
      z-index: 1;
      pointer-events: auto;
    }

    > :deep(.hospital-intro) {
      flex-shrink: 0;
    }
  }

  &__panel-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    position: relative;
    z-index: 1;

    > :deep(*) {
      pointer-events: auto;
      flex: 1;
      min-height: 0;
    }
  }
}

</style>
