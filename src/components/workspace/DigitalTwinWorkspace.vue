<script setup lang="ts">
import { roomCallTasks } from '@/core/ward-call-list';
import WardInteriorStatus from '@/components/WardInteriorStatus.vue';
import { wardBedPatientKey } from '@/core/ward-data-binding';
import { wardInteriorRoomKey, selectOccupiedWardBeds } from '@/core/ward-interior-beds';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { defineRecoverableComponent } from '@/core/define-recoverable-component';
import { useWorkspacePanels } from '@/core/use-workspace-panels';
import { buildWorkspaceMetrics, getAreaTemperature } from '@/core/workspace-metrics';
import DashboardBottomNav from '@/components/dashboard/DashboardBottomNav.vue';
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue';
import DashboardLeftPanel from '@/components/dashboard/DashboardLeftPanel.vue';
import AreaSwitcher from '@/components/AreaSwitcher.vue';
import SceneSwitchLoader from '@/components/SceneSwitchLoader.vue';
import EnvAlertBanner from '@/components/EnvAlertBanner.vue';
import { formatBedLabel } from '@/core/alert-workflow';
import type { TwinBedEntity } from '@/types/twin';
import type { AlertTask } from '@/core/alert-workflow';
import { buildAreaSceneIdentity } from '@/core/area-scene-identity';
import { useSceneLoading } from '@/core/use-scene-loading';
import { useTwinStore } from '@/stores/twin-store';
import { resolveDataStatus } from '@/core/data-status';
import { resolveWardInteriorDataStatus } from '@/core/ward-interior-status';
import { buildNurseStationViewModel } from '@/core/nurse-station-view-model';
import { ALERT_ACK_STORAGE_KEY } from '@/core/alert-ack';
import { SWP_CALL_ALERTS_STORAGE_KEY } from '@/services/swp-call-notifier';

const { theme, operatorName, operatorRole } = defineProps<{
  theme: 'dark' | 'light';
  operatorName: string;
  operatorRole: string;
}>();
const emit = defineEmits<{ toggleTheme: []; logout: [] }>();
function toggleTheme() { emit('toggleTheme'); }
function handleLogout() { emit('logout'); }
const store = useTwinStore();
const AreaScene3D = defineRecoverableComponent(() => import('@/components/AreaScene3D.vue'));
const WardScene3D = defineRecoverableComponent(() => import('@/components/WardScene3D.vue'));
const WardPlanView = defineRecoverableComponent(() => import('@/components/WardPlanView.vue'));
const NurseStationPanel = defineRecoverableComponent(() => import('@/components/NurseStationPanel.vue'));
const NurseStationVisualScene = defineRecoverableComponent(() => import('@/components/NurseStationVisualScene.vue'));
const HospitalIntroPanel = defineRecoverableComponent(() => import('@/components/HospitalIntroPanel.vue'));
const AreaInfoPanel = defineRecoverableComponent(() => import('@/components/AreaInfoPanel.vue'));
const WardInfoPanel = defineRecoverableComponent(() => import('@/components/WardInfoPanel.vue'));
const WardLegend = defineRecoverableComponent(() => import('@/components/WardLegend.vue'));
const WardPlanBedDialog = defineRecoverableComponent(() => import('@/components/WardPlanBedDialog.vue'));
const isAreaSwitcherOpen = ref(false);
let dataStatusTimer: number | null = null;
const dataStatusNow = ref(Date.now());
const NURSE_STATION_WALLBOARD_KEY = 'ward-digital-twin:nurse-station-wallboard';

function readBooleanPreference(key: string) {
  if (typeof window === 'undefined')
    return false;
  try {
    return window.localStorage.getItem(key) === 'true';
  }
  catch {
    return false;
  }
}

function writeBooleanPreference(key: string, value: boolean) {
  if (typeof window === 'undefined')
    return;
  try {
    window.localStorage.setItem(key, String(value));
  }
  catch {
    // Wallboard preference is optional and must not block the workspace.
  }
}

const nurseStationWallboard = ref(readBooleanPreference(NURSE_STATION_WALLBOARD_KEY));

const {
  area,
  areaOptions,
  selectedAreaId,
  pendingAreaId,
  isAreaSwitching,
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
  hospitalInfoError,
  dataWarnings,
  dataPhase,
  lastFetchedAtMs,
  bedDetailsLoading,
  bedDetailsIssues,
  currentWardSnapshotRetained,
  alertTasks,
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

const currentRoomCalls = computed(() => currentWard.value ? roomCallTasks(alertTasks.value, currentWard.value, currentRoomIndex.value) : []);

const wardInteriorDataStatus = computed(() => resolveWardInteriorDataStatus({
  phase: dataPhase.value,
  lastFetchedAtMs: lastFetchedAtMs.value,
  nowMs: dataStatusNow.value,
  busy: bedDetailsLoading.value,
  issues: bedDetailsIssues.value,
  snapshotRetained: currentWardSnapshotRetained.value,
}));

const nurseStationViewModel = computed(() => area.value
  ? buildNurseStationViewModel({
      areaId: selectedAreaId.value,
      area: area.value,
      roomSummaries: roomSummaries.value,
      configuredDeviceCount: deviceCodes.value.length,
      alertTasks: alertTasks.value,
      swpEvents: swpEvents.value,
      swpResponseMetrics: swpResponseMetrics.value,
      swpEventSync: swpEventSync.value,
      swpResponseSync: swpResponseSync.value,
      inspectionRoomSummaries: inspectionRoomSummaries.value,
      inspectionSync: inspectionSync.value,
      wardDataStatus: dataStatus.value,
      wardDataSyncedAtMs: lastFetchedAtMs.value,
    })
  : null);

const planDialogBedCode = ref<string | null>(null);
function openPlanBed(bed: TwinBedEntity) {
  store.selectBed(bed);
  planDialogBedCode.value = bed.bedCode;
}
function closePlanBed() { planDialogBedCode.value = null; }
watch(() => [wardInteriorView.value, sceneType.value,
  currentWard.value ? wardInteriorRoomKey(currentWard.value) : '',
  selectedBed.value ? wardBedPatientKey(selectedBed.value) : ''], closePlanBed, { flush: 'sync' });
const wardSyncBusy = computed(() => bedDetailsLoading.value || dataPhase.value === 'loading');
async function retryWardSync() {
  if (wardSyncBusy.value) return;
  if (store.dataSource === 'mock') await store.refreshWardBedDetails();
  else await store.refreshCurrentArea({ preserveScene: true, silent: true });
}

const occupiedPlanWard = computed(() => currentWard.value
  ? { ...currentWard.value, beds: selectOccupiedWardBeds(currentWard.value).beds }
  : null);
const preloadedWard = computed(() => currentWard.value ?? area.value?.rooms[0] ?? null);
const currentInspectionSummary = computed(() =>
  currentRoomIndex.value >= 0
    ? inspectionRoomSummaries.value[currentRoomIndex.value] ?? null
    : null,
);
const vitalWarningBedCodes = computed(() => {
  const ward = preloadedWard.value;
  if (!ward)
    return [];
  return alertTasks.value
    .filter(task =>
      task.type === 'vital'
      && task.roomCode === ward.sickroomCode
      && !!task.bedCode,
    )
    .map(task => task.bedCode as string);
});
const stationSceneActive = computed(() => isNurseStation.value);
const corridorSceneActive = computed(() => isWard.value);
const interiorSceneActive = computed(() => isWardInterior.value && wardInteriorView.value === '3d');
const sceneScope = computed(() => area.value
  ? buildAreaSceneIdentity(selectedAreaId.value)
  : null);
const requestedScene = computed(() => isWardInterior.value && wardInteriorView.value === 'plan'
  ? null
  : sceneType.value);
const { scenes, feedback: sceneSwitchFeedback, retry: retryScene } = useSceneLoading(sceneScope, requestedScene);
const stationModelState = computed(() => scenes.value['nurse-station'].state);

const { panelsVisible } = useWorkspacePanels(sceneType, wardInteriorView, sceneScope);
watch(sceneScope, () => { isAreaSwitcherOpen.value = false; });

watch(nurseStationWallboard, value => {
  writeBooleanPreference(NURSE_STATION_WALLBOARD_KEY, value);
});

function handlingActionText() {
  return '处理中';
}

function canMarkHandling(task: AlertTask) {
  return !isDisplayOnlySwpCall(task) && task.status !== 'handling';
}

function isDisplayOnlySwpCall(task: AlertTask) {
  return task.source === 'swp-call' && (task.type === 'call' || task.type === 'vital');
}

function taskStatusText(task: AlertTask) {
  if (task.source === 'swp-call' && task.type === 'vital')
    return '预警中';
  if (isDisplayOnlySwpCall(task))
    return '呼叫中';
  if (task.status !== 'handling')
    return '待处理';
  return '处理中';
}

const envTemp = computed(() => getAreaTemperature(area.value));
const keyMetrics = computed(() => buildWorkspaceMetrics(area.value, hospitalInfo.value));

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
  if (type === 'vital')
    return '生命体征预警';
  if (type === 'env')
    return '环境异常';
  if (type === 'offline')
    return '设备巡检';
  if (type === 'inspection')
    return '巡视超时';
  return '输液巡视';
}

function handleSceneTypeChange(type: typeof sceneType.value) {
  store.setSceneType(type);
}

function setNurseStationWallboard(enabled: boolean) {
  nurseStationWallboard.value = enabled;
  if (enabled)
    panelsVisible.value = true;
}

async function handleAreaSwitch(areaId: number) {
  const success = await store.switchArea(areaId);
  if (success)
    isAreaSwitcherOpen.value = false;
}

function handleStorage(event: StorageEvent) {
  if (event.key === ALERT_ACK_STORAGE_KEY)
    store.reloadAlertAckRecords();
  if (event.key === SWP_CALL_ALERTS_STORAGE_KEY)
    store.reloadCallAlertsEnabled();
  if (event.key === NURSE_STATION_WALLBOARD_KEY)
    nurseStationWallboard.value = event.newValue === 'true';
}

onMounted(() => {
  window.addEventListener('storage', handleStorage);
  dataStatusTimer = window.setInterval(() => { dataStatusNow.value = Date.now(); }, 30_000);
});

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorage);
  if (dataStatusTimer) window.clearInterval(dataStatusTimer);
});
</script>



<template>
  <div v-if="area" class="digital-twin" :data-theme="theme">
    <div
      class="digital-twin__main"
      :class="{
        'digital-twin__main--station': isNurseStation,
        'digital-twin__main--ward': isWard || isWardInterior,
        'digital-twin__main--interior': isWardInterior,
        'digital-twin__main--plan': isWardInterior && wardInteriorView === 'plan',
        'digital-twin__main--wallboard': isNurseStation && nurseStationWallboard,
        'digital-twin__main--panels-hidden': !panelsVisible,
        'digital-twin__main--scene-switching': !!sceneSwitchFeedback,
      }"
    >
      <DashboardHeader
        :theme="theme"
        @toggle-theme="toggleTheme"
        :area-name="area.areaName"
        :dept-name="area.deptName"
        :env-temp="envTemp"
        :is-loading="isLoading"
        :can-switch-area="areaOptions.length > 1"
        :is-area-switching="isAreaSwitching"
        :data-source="dataSource"
        :data-status="dataStatus"
        :operator-name="operatorName"
        :operator-role="operatorRole"
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
        <DashboardLeftPanel v-if="panelsVisible && isNurseStation" :area="area" />




        <div
          v-if="activeAlertTask && isWardInterior && panelsVisible"
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
              <span>{{ activeAlertTask.type === 'vital' ? '生命体征预警' : alertTypeLabel(activeAlertTask.type) }}</span>
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
            <span v-if="activeAlertTask.type === 'vital'">
              后端状态恢复后自动结束
            </span>
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

        <div v-if="isWardInterior" class="ward-overview">
        <WardInteriorStatus
          v-if="isWardInterior && currentWard"
          :ward="currentWard"
          :status="wardInteriorDataStatus"
          :busy="wardSyncBusy"
          :last-synced-at="lastFetchedAtMs"
          :issues="bedDetailsIssues"
          :snapshot-retained="currentWardSnapshotRetained"
          @retry="retryWardSync"
        />
        <EnvAlertBanner
          v-if="isWardInterior && currentWard && panelsVisible"
          class="digital-twin__env-banner"
          :alert="currentEnvAlert"
        />
        </div>
        <WardLegend v-if="isWard && panelsVisible" />


        <NurseStationVisualScene
          :theme="theme"
          v-if="nurseStationViewModel && scenes['nurse-station'].requested"
          :key="scenes['nurse-station'].key"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !stationSceneActive }"
          :view-model="nurseStationViewModel"
          :overlays-visible="panelsVisible"
          :model-state="stationModelState"
          :active="stationSceneActive"
          @room-click="store.enterRoom"
          @model-state="scenes['nurse-station'].onState"
        />

        <AreaScene3D
          :theme="theme"
          v-if="area && scenes.ward.requested"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !corridorSceneActive }"
          :key="scenes.ward.key"
          :area-id="selectedAreaId"
          :area="area"
          :room-summaries="roomSummaries"
          :focused-room-index="currentRoomIndex"
          :configured-device-count="deviceCodes.length"
          scene-type="ward"
          model-kind="corridor"
          :alert-title="activeAlertTask?.title"
          :panels-visible="panelsVisible"
          @reset-corridor="store.setSceneType('ward')"
          :active="corridorSceneActive"
          @model-state="scenes.ward.onState"
          @room-click="store.enterRoom"
          @focus-room="store.focusRoom"
        />

        <WardScene3D
          v-if="preloadedWard && scenes['ward-interior'].requested"
          :key="scenes['ward-interior'].key"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': !interiorSceneActive }"
          :ward="preloadedWard"
          :theme="theme"
          :data-status="wardInteriorDataStatus"
          shared-status
          :camera-preset="cameraPreset"
          :env-alert-level="currentEnvAlert.level"
          :selected-bed-code="selectedBed?.bedCode ?? null"
          :vital-warning-bed-codes="vitalWarningBedCodes"
          :active="interiorSceneActive"
          @model-state="scenes['ward-interior'].onState"
          @bed-click="store.selectBed"
          @request-plan="store.setWardInteriorView('plan')"
        />
        <WardPlanView
          v-if="isWardInterior && occupiedPlanWard && wardInteriorView !== '3d'"
          class="digital-twin__scene-layer"
          :class="{ 'digital-twin__scene-layer--inactive': wardInteriorView !== 'plan' }"
          :ward="occupiedPlanWard"
          :theme="theme"
          :selected-bed="selectedBed"
          @bed-click="openPlanBed"
        />

        <WardPlanBedDialog
          :data-status="wardInteriorDataStatus"
          :theme="theme"
          v-if="isWardInterior && wardInteriorView === 'plan' && selectedBed && selectedBed.isOccupied && planDialogBedCode === selectedBed.bedCode"
          :bed="selectedBed"
          @close="closePlanBed"
        />

      </div>

      <div :class="{ 'ward-navigation-dock': isWardInterior }">
      <div id="ward-tools-host"><WardLegend v-if="isWardInterior && wardInteriorView === 'plan'" embedded /></div>
      <DashboardBottomNav
        v-if="!(isNurseStation && nurseStationWallboard)"
        :scene-type="sceneType"
        :ward-interior-view="wardInteriorView"
        :is-simulating="isSimulating"
        :data-source="dataSource"
        :compact="isNurseStation"
        @set-scene-type="handleSceneTypeChange"
        @set-ward-interior-view="store.setWardInteriorView"
        @toggle-simulation="store.toggleSimulation()"
      />

      </div>
      <SceneSwitchLoader
        :feedback="sceneSwitchFeedback"
        @retry="retryScene"
        @return-station="handleSceneTypeChange('nurse-station')"
      />

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
            v-if="nurseStationViewModel"
            :view-model="nurseStationViewModel"
            :status-history="statusHistory"
            :alert-ack-records="alertAckRecords"
            :call-alerts-enabled="callAlertsEnabled"
            :data-source="dataSource"
            :wallboard="nurseStationWallboard"
            @focus-room="store.focusRoom"
            @locate-alert="store.openAlertTask"
            @mark-alert-handling="store.markAlertHandling"
            @acknowledge-alert="store.acknowledgeSourceAlert"
            @set-call-alerts-enabled="store.setCallAlertsEnabled"
            @set-wallboard="setNurseStationWallboard"
          />
        </template>

        <template v-else>
          <HospitalIntroPanel
            v-if="isWard"
            :info="hospitalInfo"
            :loading="hospitalInfoLoading"
            :error="hospitalInfoError"
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
              @acknowledge-alert="store.acknowledgeSourceAlert"
            />

            <WardInfoPanel
              :call-tasks="currentRoomCalls"
              :call-sync="swpEventSync"
              @locate-call="store.openAlertTask"
              :data-status="wardInteriorDataStatus"
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
              @bed-click="store.selectBed"
              @mark-alert-handling="store.markAlertHandling"
            />
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>



<style scoped lang="scss" src="@/styles/digital-twin-workspace.scss"></style>
