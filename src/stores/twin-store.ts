import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { syncAlertAck } from '@/api/alert-ack';
import { clearAreaDiscoveryCache } from '@/api/area-context';
import { fetchDatabaseAreas, fetchDatabaseTwinArea } from '@/api/database-twin';
import { fetchHospitalAreas } from '@/api/hospital-area';
import {
  fetchDoorDeviceList,
  getConfiguredDeviceCodes,
  getDataSource,
  validateDoorDeviceCodes,
  type DataSource,
} from '@/api/door-device';
import { fetchHospitalInfo } from '@/api/hospital-info';
import { mapDoorListToTwinArea } from '@/types/twin';
import { analyzeEnvAlert } from '@/core/env-alert';
import { resolveBedStatus } from '@/core/bed-status';
import { summarizeArea } from '@/core/area-summary';
import {
  allowAllAreaAccessPolicy,
  resolvePreferredAreaId,
  resolveRememberedAreaId,
} from '@/core/area-access';
import { createAreaRequestGuard } from '@/core/area-request-guard';
import { clearTemplateCache } from '@/core/template/template-cache';
import { reconcileRealAreaSnapshot } from '@/core/real-area-reconcile';
import {
  createAlertFocus,
  collectAlertTasks,
  collectLocallyHiddenSwpAlertTasks,
  collectSwpAlertTasks,
  findAlertTaskForTarget,
  isAlertFocusExpired,
  isAlertFocusForTask,
  mergeAlertTasks,
  resolveAlertTargetInArea,
  resolveNextAlertTarget,
  suppressLocalBedCallsShadowedBySwp,
  type AlertAckState,
  type AlertFocusState,
  type AlertTask,
  type AlertTaskStatus,
} from '@/core/alert-workflow';
import {
  clearRecoveredAlertAckRecords,
  loadAlertAckRecords,
  getDefaultAlertOperator,
  removeAlertAckRecord,
  updateAlertAckSyncState,
  upsertAlertAckRecord,
  type AlertAckRecordMap,
} from '@/core/alert-ack';
import { startCallPusher, stopCallPusher } from '@/services/call-pusher';
import { startEnvFetcher, stopEnvFetcher } from '@/services/env-fetcher';
import { startEnvSimulator, stopEnvSimulator } from '@/services/env-simulator';
import { startRealtimeChannel, stopRealtimeChannel } from '@/services/realtime-channel';
import { startRemoteAreaFetcher, stopRemoteAreaFetcher } from '@/services/remote-area-fetcher';
import { startSwpEventPoller, stopSwpEventPoller } from '@/services/swp-event-poller';
import {
  disableSwpCallAlerts,
  enableSwpCallAlerts,
  loadSwpCallAlertsEnabled,
  notifyNewSwpCalls,
} from '@/services/swp-call-notifier';
import { loadBedDeviceDetails, preloadBedTemplates } from '@/services/bed-device-loader';
import { clearBedTemplateIdCache } from '@/services/bed-template-enricher';
import { startStatusPusher, stopStatusPusher } from '@/services/status-pusher';
import type {
  CameraPresetId,
  StatusHistoryEntry,
  TwinAreaEntity,
  TwinBedEntity,
  TwinSceneType,
  TwinWardEntity,
  WardInteriorView,
} from '@/types/twin';
import type { EnvAlertResult } from '@/core/env-alert';
import type { HospitalInfo } from '@/types/hospital';
import type { HospAreaRecord } from '@/types/hospital-area';
import type { DoorEnvParams, StatusBarInfo } from '@/types/ward';
import { getAreaId } from '@/utils/device-cache';
import type { DataPhase } from '@/core/data-status';
import type {
  NormalizedSwpEvent,
  SwpEventSource,
  SwpEventSyncState,
  SwpResponseMetrics,
} from '@/types/swp-events';

const MAX_HISTORY = 30;
const AREA_STORAGE_KEY = 'ward-digital-twin:last-area-id';
let historySequence = 0;

function emptySwpResponseMetrics(): SwpResponseMetrics {
  return {
    callCount: 0,
    arrivedCallCount: 0,
    unattendedCallCount: 0,
    arrivalCount: 0,
    averageResponseSeconds: null,
    latestCallAt: null,
  };
}

function readStoredAreaId(): string | null {
  if (typeof window === 'undefined')
    return null;
  try {
    return window.localStorage.getItem(AREA_STORAGE_KEY);
  }
  catch {
    return null;
  }
}

function removeStoredAreaId(): void {
  if (typeof window === 'undefined')
    return;
  try {
    window.localStorage.removeItem(AREA_STORAGE_KEY);
  }
  catch {
    // Browser storage may be unavailable; ward selection must remain usable.
  }
}

function writeStoredAreaId(areaId: number): void {
  if (typeof window === 'undefined')
    return;
  try {
    window.localStorage.setItem(AREA_STORAGE_KEY, String(areaId));
  }
  catch {
    // Persistence is optional and must not invalidate a successful ward load.
  }
}

interface LoadAreaOptions {
  preserveScene?: boolean;
  silent?: boolean;
}

interface AreaSnapshot {
  area: TwinAreaEntity;
  deviceCodes: string[];
  hospitalInfo: HospitalInfo | null;
  warnings: string[];
}

interface FetchAreaSnapshotOptions {
  refreshDeviceList?: boolean;
  preserveLastValidRooms?: boolean;
}

export const useTwinStore = defineStore('twin', () => {
  const area = ref<TwinAreaEntity | null>(null);
  const areaOptions = ref<HospAreaRecord[]>([]);
  const selectedAreaId = ref<number | null>(null);
  const pendingAreaId = ref<number | null>(null);
  const preferredAreaId = ref<number | null>(null);
  const rememberedAreaId = ref<number | null>(null);
  const isAreaListLoading = ref(false);
  const isAreaSwitching = ref(false);
  const areaListError = ref<string | null>(null);
  const areaSwitchError = ref<string | null>(null);
  const areaListRequestGuard = createAreaRequestGuard();
  const areaRequestGuard = createAreaRequestGuard();
  const refreshLoadingGuard = createAreaRequestGuard();
  const remoteServiceOperationGuard = createAreaRequestGuard();
  let selectionGeneration = 0;
  const currentRoomIndex = ref(-1);
  const selectedBedCode = ref<string | null>(null);
  const alertFocus = ref<AlertFocusState | null>(null);
  let alertFocusTimer: ReturnType<typeof setTimeout> | null = null;
  const alertLocateNotice = ref<string | null>(null);
  let alertLocateNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 三类型场景：护士站 | 病房 | 病房内 */
  const sceneType = ref<TwinSceneType>('nurse-station');
  /** 病房内子视图（仅 sceneType === 'ward-interior' 时生效） */
  const wardInteriorView = ref<WardInteriorView>('3d');
  const cameraPreset = ref<CameraPresetId>('free');
  const isSimulating = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const bedDetailsLoading = ref(false);
  const bedDetailsError = ref<string | null>(null);
  let bedDetailsRequestGeneration = 0;
  const statusHistory = ref<StatusHistoryEntry[]>([]);
  const dataSource = ref<DataSource>(getDataSource());
  const deviceCodes = ref<string[]>(getConfiguredDeviceCodes());
  const lastFetchedAt = ref<string | null>(null);
  const lastFetchedAtMs = ref<number | null>(null);
  const dataWarnings = ref<string[]>([]);
  const dataPhase = ref<DataPhase>('idle');
  const hospitalInfo = ref<HospitalInfo | null>(null);
  const hospitalInfoLoading = ref(false);
  const alertAckRecords = ref<AlertAckRecordMap>(typeof window === 'undefined' ? {} : loadAlertAckRecords());
  const alertOperator = ref(getDefaultAlertOperator());
  const callAlertsEnabled = ref(loadSwpCallAlertsEnabled());
  const swpEvents = ref<NormalizedSwpEvent[]>([]);
  const swpResponseMetrics = ref<SwpResponseMetrics>(emptySwpResponseMetrics());
  const swpEventSync = ref<SwpEventSyncState>({
    phase: 'idle',
    lastSyncedAt: null,
    error: null,
    warning: null,
  });
  const swpResponseSync = ref<SwpEventSyncState>({
    phase: 'idle',
    lastSyncedAt: null,
    error: null,
    warning: null,
  });
  const alertAckState = computed<AlertAckState>(() =>
    Object.fromEntries(Object.entries(alertAckRecords.value).map(([key, value]) => [key, {
      status: value.status,
      eventStartedAt: value.eventStartedAt,
    }])),
  );

  const isNurseStation = computed(() => sceneType.value === 'nurse-station');
  const isWard = computed(() => sceneType.value === 'ward');
  const isWardInterior = computed(() => sceneType.value === 'ward-interior');

  const currentWard = computed<TwinWardEntity | null>(() => {
    if (!area.value || currentRoomIndex.value < 0)
      return null;
    return area.value.rooms[currentRoomIndex.value] ?? null;
  });

  const selectedBed = computed<TwinBedEntity | null>(() => {
    if (!selectedBedCode.value || !currentWard.value)
      return null;
    return currentWard.value.beds.find(b => b.bedCode === selectedBedCode.value) ?? null;
  });

  function clearAlertFocusSelection() {
    if (alertFocusTimer) {
      clearTimeout(alertFocusTimer);
      alertFocusTimer = null;
    }
    const focusedBedCode = alertFocus.value?.bedCode;
    alertFocus.value = null;
    if (focusedBedCode && selectedBedCode.value === focusedBedCode)
      selectedBedCode.value = null;
  }

  function focusAlertBed(task: AlertTask) {
    clearAlertFocusSelection();
    if (!task.bedCode || task.roomIndex < 0)
      return;

    selectedBedCode.value = task.bedCode;
    const focus = createAlertFocus(task.id, task.roomIndex, task.bedCode, Date.now());
    alertFocus.value = focus;
    alertFocusTimer = setTimeout(() => {
      if (!isAlertFocusExpired(alertFocus.value, Date.now()))
        return;
      clearAlertFocusSelection();
    }, Math.max(0, focus.expiresAtMs - Date.now()));
  }

  const selectedStatus = computed(() =>
    selectedBed.value ? resolveBedStatus(selectedBed.value) : null,
  );

  const currentEnvAlert = computed<EnvAlertResult>(() =>
    analyzeEnvAlert(currentWard.value?.doorEnvData),
  );

  const roomSummaries = computed(() =>
    area.value ? summarizeArea(area.value.rooms) : [],
  );

  const alertTasks = computed(() => area.value
    ? mergeAlertTasks(
        collectSwpAlertTasks(
          swpEvents.value,
          alertAckState.value,
          selectedAreaId.value ?? undefined,
        ),
        suppressLocalBedCallsShadowedBySwp(
          collectAlertTasks(area.value, alertAckState.value, selectedAreaId.value ?? undefined),
          swpEvents.value,
        ),
      )
    : []);

  const hiddenAlertTasks = computed(() =>
    collectLocallyHiddenSwpAlertTasks(
      swpEvents.value,
      alertAckState.value,
      selectedAreaId.value ?? undefined,
    ),
  );

  watch(
    [selectedAreaId, alertTasks],
    ([areaId, tasks], [previousAreaId, previousTasks]) => {
      if (areaId == null || areaId !== previousAreaId)
        return;
      const currentTaskIds = tasks.map(task => task.id);
      const currentTaskIdSet = new Set(currentTaskIds);
      const recoveredTaskIds = previousTasks
        .map(task => task.id)
        .filter(taskId => !currentTaskIdSet.has(taskId));
      for (const taskId of recoveredTaskIds) {
        if (isAlertFocusForTask(alertFocus.value, taskId)) {
          clearAlertFocusSelection();
          break;
        }
      }
      alertAckRecords.value = clearRecoveredAlertAckRecords(
        alertAckRecords.value,
        previousTasks.map(task => task.id),
        currentTaskIds,
      );
    },
  );

  const alertStats = computed(() => {
    const tasks = alertTasks.value;
    return {
      total: tasks.length,
      critical: tasks.filter(task => task.severity === 'critical').length,
      handling: tasks.filter(task => task.status === 'handling').length,
      pending: tasks.filter(task => task.status === 'pending').length,
    };
  });

  const activeAlertTask = computed(() =>
    findAlertTaskForTarget(alertTasks.value, {
      sceneType: sceneType.value,
      roomIndex: currentRoomIndex.value,
      bedCode: selectedBedCode.value ?? undefined,
    }, area.value ?? undefined),
  );

  function ensureRoomForInterior() {
    if (!area.value?.rooms.length)
      return false;
    if (currentRoomIndex.value < 0)
      currentRoomIndex.value = 0;
    return true;
  }

  function setSceneType(type: TwinSceneType) {
    if (type === 'ward-interior' && !ensureRoomForInterior())
      return;

    sceneType.value = type;

    if (type === 'nurse-station' || type === 'ward') {
      bedDetailsRequestGeneration += 1;
      bedDetailsLoading.value = false;
      bedDetailsError.value = null;
      clearAlertFocusSelection();
      currentRoomIndex.value = -1;
      selectedBedCode.value = null;
    }
    else if (currentRoomIndex.value < 0) {
      currentRoomIndex.value = 0;
    }

    if (type === 'ward-interior')
      void loadCurrentWardBedDetails();
  }

  function setWardInteriorView(view: WardInteriorView) {
    if (!ensureRoomForInterior())
      return;
    wardInteriorView.value = view;
    sceneType.value = 'ward-interior';
    void loadCurrentWardBedDetails();
  }

  async function loadCurrentWardBedDetails() {
    const room = currentWard.value;
    if (!room)
      return;
    const requestGeneration = ++bedDetailsRequestGeneration;
    bedDetailsLoading.value = true;
    bedDetailsError.value = null;
    try {
      const result = await loadBedDeviceDetails(
        room.beds,
        () => requestGeneration === bedDetailsRequestGeneration && currentWard.value === room,
        { forceRefresh: false },
      );
      if (requestGeneration === bedDetailsRequestGeneration && currentWard.value === room && result.warnings.length)
        bedDetailsError.value = result.warnings.join('；');
    }
    finally {
      if (requestGeneration === bedDetailsRequestGeneration)
        bedDetailsLoading.value = false;
    }
  }

  async function loadAreaOptions() {
    const requestToken = areaListRequestGuard.begin();
    isAreaListLoading.value = true;
    areaListError.value = null;
    try {
      dataSource.value = getDataSource();
      const areas = dataSource.value === 'database'
        ? (await fetchDatabaseAreas()).map(item => ({
            id: item.id,
            areaName: item.areaName,
            areaCode: item.areaCode,
            areaOutCode: '',
            isEnable: '1',
          }))
        : allowAllAreaAccessPolicy.filterAreas(await fetchHospitalAreas());
      if (!areaListRequestGuard.isCurrent(requestToken))
        return;
      areaOptions.value = areas;
      const storedId = readStoredAreaId();
      rememberedAreaId.value = resolveRememberedAreaId(areas, storedId);
      preferredAreaId.value = resolvePreferredAreaId(areas, storedId, getAreaId());
      if (storedId != null && rememberedAreaId.value == null)
        removeStoredAreaId();
    }
    catch (e) {
      if (!areaListRequestGuard.isCurrent(requestToken))
        return;
      areaOptions.value = [];
      preferredAreaId.value = null;
      rememberedAreaId.value = null;
      areaListError.value = e instanceof Error ? e.message : '病区列表加载失败';
      throw e;
    }
    finally {
      if (areaListRequestGuard.isCurrent(requestToken))
        isAreaListLoading.value = false;
    }
  }

  async function fetchAreaSnapshot(
    areaId: number,
    options: FetchAreaSnapshotOptions = {},
  ): Promise<AreaSnapshot> {
    const selectedOption = areaOptions.value.find(item => item.id === areaId);
    if (!selectedOption)
      throw new Error('所选病区不在当前角色的授权范围内');

    if (dataSource.value === 'database') {
      const result = await fetchDatabaseTwinArea(selectedOption.areaCode);
      if (!result.area.rooms.length)
        throw new Error('数据库适配器未返回任何病房数据');
      return {
        area: result.area,
        deviceCodes: result.deviceCodes,
        hospitalInfo: result.hospitalInfo,
        warnings: result.warnings,
      };
    }

    const [deviceResult, hospitalResult] = await Promise.allSettled([
      fetchDoorDeviceList({ areaId, refreshDeviceList: options.refreshDeviceList }),
      fetchHospitalInfo(),
    ]);
    if (deviceResult.status === 'rejected')
      throw deviceResult.reason instanceof Error ? deviceResult.reason : new Error('获取门口机数据失败');
    const result = deviceResult.value;
    const hospital = hospitalResult.status === 'fulfilled' ? hospitalResult.value : null;
    if (!result.devices.length)
      throw new Error('未获取到任何病房数据');

    let nextArea = mapDoorListToTwinArea(result.devices);
    nextArea.areaName = selectedOption.areaName;
    nextArea.areaCode = selectedOption.areaCode;
    const warnings = [...result.warnings, ...validateDoorDeviceCodes(result.devices)];
    if (options.preserveLastValidRooms) {
      const reconciled = reconcileRealAreaSnapshot(nextArea, area.value, result.codes);
      nextArea = reconciled.area;
      if (reconciled.retainedDeviceCodes.length) {
        warnings.push(
          `${reconciled.retainedDeviceCodes.length} 间病房详情刷新失败，当前保留上一次有效数据`,
        );
      }
    }
    const bedResult = await loadBedDeviceDetails(
      nextArea.rooms.flatMap(room => room.beds),
      () => true,
      { forceRefresh: true },
    );
    warnings.push(...bedResult.warnings);
    warnings.push(...await preloadBedTemplates(nextArea.rooms.flatMap(room => room.beds)));
    if (!hospital) {
      const reason = hospitalResult.status === 'rejected' && hospitalResult.reason instanceof Error
        ? `：${hospitalResult.reason.message}`
        : '';
      warnings.push(`医院基本信息接口失败或返回空数据${reason}`);
    }
    return {
      area: nextArea,
      deviceCodes: result.codes,
      hospitalInfo: hospital,
      warnings,
    };
  }

  async function commitRequestedArea(areaId: number, mode: 'enter' | 'switch'): Promise<boolean> {
    const requestToken = areaRequestGuard.begin();
    pendingAreaId.value = areaId;
    isAreaSwitching.value = true;
    areaSwitchError.value = null;
    dataPhase.value = 'loading';
    try {
      const snapshot = await fetchAreaSnapshot(areaId);
      if (!areaRequestGuard.isCurrent(requestToken))
        return false;
      area.value = snapshot.area;
      deviceCodes.value = snapshot.deviceCodes;
      hospitalInfo.value = snapshot.hospitalInfo;
      dataWarnings.value = snapshot.warnings;
      selectedAreaId.value = areaId;
      resetSwpEventState();
      rememberedAreaId.value = areaId;
      selectionGeneration += 1;
      statusHistory.value = [];
      sceneType.value = 'nurse-station';
      currentRoomIndex.value = -1;
      clearAlertFocusSelection();
      selectedBedCode.value = null;
      wardInteriorView.value = '3d';
      lastFetchedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      lastFetchedAtMs.value = Date.now();
      dataPhase.value = 'ready';
      writeStoredAreaId(areaId);
      return true;
    }
    catch (e) {
      if (areaRequestGuard.isCurrent(requestToken))
        areaSwitchError.value = e instanceof Error ? e.message : `${mode === 'enter' ? '进入' : '切换'}病区失败`;
      if (areaRequestGuard.isCurrent(requestToken))
        dataPhase.value = 'error';
      return false;
    }
    finally {
      if (areaRequestGuard.isCurrent(requestToken)) {
        pendingAreaId.value = null;
        isAreaSwitching.value = false;
      }
    }
  }

  async function enterArea(areaId: number) {
    if (!['remote', 'database'].includes(dataSource.value))
      return false;
    const success = await commitRequestedArea(areaId, 'enter');
    if (success && dataSource.value === 'remote')
      startRemoteServices();
    return success;
  }

  async function switchArea(areaId: number) {
    if (!['remote', 'database'].includes(dataSource.value))
      return false;
    if (selectedAreaId.value === areaId) {
      if (isAreaSwitching.value) {
        areaRequestGuard.begin();
        pendingAreaId.value = null;
        areaSwitchError.value = null;
        isAreaSwitching.value = false;
        if (dataSource.value === 'remote')
          startRemoteServices();
      }
      return true;
    }
    if (!allowAllAreaAccessPolicy.canSwitchArea(selectedAreaId.value ?? areaId, areaId))
      return false;
    const managesRemoteServices = dataSource.value === 'remote';
    const serviceOperationToken = managesRemoteServices
      ? stopRemoteServices()
      : remoteServiceOperationGuard.begin();
    const success = await commitRequestedArea(areaId, 'switch');
    if (
      managesRemoteServices
      && remoteServiceOperationGuard.isCurrent(serviceOperationToken)
      && !isAreaSwitching.value
    )
      startRemoteServices();
    return success;
  }

  async function refreshCurrentArea(options: LoadAreaOptions = {}) {
    const areaId = selectedAreaId.value;
    if (!['remote', 'database'].includes(dataSource.value) || areaId == null || isAreaSwitching.value)
      return false;
    const requestToken = areaRequestGuard.begin();
    const previousSceneType = sceneType.value;
    const previousRoomIndex = currentRoomIndex.value;
    const previousBedCode = selectedBedCode.value;
    const previousInteriorView = wardInteriorView.value;
    const loadingToken = options.silent ? null : refreshLoadingGuard.begin();
    if (loadingToken != null)
      isLoading.value = true;
    dataPhase.value = 'loading';
    try {
      const snapshot = await fetchAreaSnapshot(areaId, {
        refreshDeviceList: true,
        preserveLastValidRooms: true,
      });
      if (!areaRequestGuard.isCurrent(requestToken) || selectedAreaId.value !== areaId)
        return false;
      area.value = snapshot.area;
      deviceCodes.value = snapshot.deviceCodes;
      hospitalInfo.value = snapshot.hospitalInfo;
      dataWarnings.value = snapshot.warnings;
      if (options.preserveScene) {
        sceneType.value = previousSceneType;
        currentRoomIndex.value = previousRoomIndex >= 0 && previousRoomIndex < snapshot.area.rooms.length
          ? previousRoomIndex
          : -1;
        selectedBedCode.value = previousBedCode;
        wardInteriorView.value = previousInteriorView;
        if (previousSceneType === 'ward-interior' && currentRoomIndex.value >= 0)
          await loadCurrentWardBedDetails();
      }
      lastFetchedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      lastFetchedAtMs.value = Date.now();
      dataPhase.value = 'ready';
      return true;
    }
    catch (e) {
      if (!options.silent && areaRequestGuard.isCurrent(requestToken))
        error.value = e instanceof Error ? e.message : '刷新病区失败';
      if (areaRequestGuard.isCurrent(requestToken))
        dataPhase.value = 'error';
      return false;
    }
    finally {
      if (loadingToken != null && refreshLoadingGuard.isCurrent(loadingToken))
        isLoading.value = false;
    }
  }

  async function loadArea(options: LoadAreaOptions = {}) {
    const previousSceneType = sceneType.value;
    const previousRoomIndex = currentRoomIndex.value;
    const previousBedCode = selectedBedCode.value;
    const previousWardInteriorView = wardInteriorView.value;

    if (!options.silent)
      isLoading.value = true;
    error.value = null;
    dataPhase.value = 'loading';
    if (!options.silent)
      hospitalInfoLoading.value = true;
    try {
      dataSource.value = getDataSource();
      if (dataSource.value === 'database') {
        const result = await fetchDatabaseTwinArea();
        if (!result.area.rooms.length)
          throw new Error('数据库适配器未返回任何病房数据');
        area.value = result.area;
        deviceCodes.value = result.deviceCodes;
        hospitalInfo.value = result.hospitalInfo;
        dataWarnings.value = result.warnings;
        statusHistory.value = result.history.slice(0, MAX_HISTORY);
      }
      else if (dataSource.value === 'mock') {
        const [deviceResult, hospitalResult] = await Promise.allSettled([
          fetchDoorDeviceList(),
          fetchHospitalInfo(),
        ]);
        if (deviceResult.status === 'rejected')
          throw deviceResult.reason instanceof Error ? deviceResult.reason : new Error('获取门口机数据失败');
        const result = deviceResult.value;
        const hospital = hospitalResult.status === 'fulfilled' ? hospitalResult.value : null;
        hospitalInfo.value = hospital;
        if (!result.devices.length)
          throw new Error('未获取到任何病房数据');
        deviceCodes.value = result.codes;
        const warnings = [...result.warnings];
        if (!hospital) {
          const reason = hospitalResult.status === 'rejected' && hospitalResult.reason instanceof Error
            ? `：${hospitalResult.reason.message}`
            : '';
          warnings.push(`医院基本信息接口失败或返回空数据${reason}`);
        }
        const nextArea = mapDoorListToTwinArea(result.devices);
        const bedResult = await loadBedDeviceDetails(
          nextArea.rooms.flatMap(room => room.beds),
          () => true,
          { forceRefresh: true },
        );
        warnings.push(...bedResult.warnings);
        warnings.push(...await preloadBedTemplates(nextArea.rooms.flatMap(room => room.beds)));
        dataWarnings.value = warnings;
        area.value = nextArea;
      }
      else {
        throw new Error('请选择病区后再加载病房数据');
      }
      if (options.preserveScene) {
        sceneType.value = previousSceneType;
        currentRoomIndex.value = previousRoomIndex >= 0 && previousRoomIndex < area.value.rooms.length
          ? previousRoomIndex
          : -1;
        selectedBedCode.value = previousBedCode;
        wardInteriorView.value = previousWardInteriorView;
      }
      else {
        sceneType.value = 'nurse-station';
        currentRoomIndex.value = -1;
        selectedBedCode.value = null;
        wardInteriorView.value = '3d';
      }
      lastFetchedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      lastFetchedAtMs.value = Date.now();
      dataPhase.value = 'ready';
    }
    catch (e) {
      if (!options.silent || !area.value) {
        error.value = e instanceof Error ? e.message : '加载失败';
        dataWarnings.value = [];
        dataPhase.value = 'error';
      }
    }
    finally {
      if (!options.silent)
        isLoading.value = false;
      if (!options.silent)
        hospitalInfoLoading.value = false;
    }
  }

  function setRoomIndex(index: number) {
    if (!area.value || index < 0 || index >= area.value.rooms.length)
      return;
    clearAlertFocusSelection();
    currentRoomIndex.value = index;
    selectedBedCode.value = null;
  }

  /** 护士站 → 病房走廊 */
  function expandToCorridor() {
    setSceneType('ward');
  }

  /** 病房 → 护士站工作台 */
  function resetAreaToStation() {
    setSceneType('nurse-station');
  }

  function focusRoom(index: number) {
    if (sceneType.value === 'nurse-station')
      setSceneType('ward');
    setRoomIndex(index);
  }

  function enterRoom(index: number) {
    setRoomIndex(index);
    cameraPreset.value = 'door';
    wardInteriorView.value = '3d';
    sceneType.value = 'ward-interior';
    void loadCurrentWardBedDetails();
  }

  function categoryForAlert(task: AlertTask): StatusHistoryEntry['category'] {
    if (task.type === 'call')
      return 'call';
    if (task.type === 'env')
      return 'env';
    if (task.type === 'offline')
      return 'device';
    return 'infusion';
  }

  function isDisplayOnlySwpCall(task: AlertTask) {
    return task.source === 'swp-call' && task.type === 'call';
  }

  async function setAlertTaskStatus(taskId: string, status: AlertTaskStatus) {
    const task = alertTasks.value.find(item => item.id === taskId);
    const taskAreaId = selectedAreaId.value;
    const taskSelectionGeneration = selectionGeneration;
    alertAckRecords.value = upsertAlertAckRecord(
      alertAckRecords.value,
      taskId,
      status,
      alertOperator.value,
      task?.startedAt,
    );
    if (!task)
      return;

    const label = status === 'handling'
      ? `开始处理：${task.title}`
      : status === 'resolved'
        ? `${task.resolveText ?? '处理完成'}：${task.title}`
        : `重新待处理：${task.title}`;

    pushHistory({
      category: categoryForAlert(task),
      bedCode: task.bedCode ?? '',
      bedName: task.bedName ?? '-',
      label,
      roomName: task.roomName,
    });

    const record = alertAckRecords.value[taskId];
    if (record) {
      try {
        let synced: boolean;
        if (isDisplayOnlySwpCall(task)) {
          synced = false;
        }
        else {
          synced = await syncAlertAck({
            ...record,
            roomName: task.roomName,
            bedName: task.bedName,
            title: task.title,
          });
        }
        alertAckRecords.value = updateAlertAckSyncState(
          alertAckRecords.value,
          taskId,
          synced ? 'synced' : 'local',
        );
      }
      catch (e) {
        if (
          selectedAreaId.value !== taskAreaId
          || selectionGeneration !== taskSelectionGeneration
        )
          return;
        alertAckRecords.value = updateAlertAckSyncState(
          alertAckRecords.value,
          taskId,
          'failed',
          e instanceof Error ? e.message : '同步失败',
        );
        pushHistory({
          category: categoryForAlert(task),
          bedCode: task.bedCode ?? '',
          bedName: task.bedName ?? '-',
          label: `处理记录待同步：${e instanceof Error ? e.message : '同步失败'}`,
          roomName: task.roomName,
        });
      }
    }
  }

  function setAlertOperator(operator: string) {
    alertOperator.value = operator.trim() || getDefaultAlertOperator();
  }

  function markAlertHandling(taskId: string) {
    const task = alertTasks.value.find(item => item.id === taskId);
    if (!task || isDisplayOnlySwpCall(task))
      return;
    void setAlertTaskStatus(taskId, 'handling');
  }

  function resolveAlertTask(taskId: string) {
    const task = alertTasks.value.find(item => item.id === taskId);
    if (!task)
      return;
    // 活动任务只能由真实来源状态恢复后自动结束，前端不再手动隐藏。
  }

  function restoreAlertTask(taskId: string) {
    const task = hiddenAlertTasks.value.find(item => item.id === taskId);
    alertAckRecords.value = removeAlertAckRecord(alertAckRecords.value, taskId);
    if (!task)
      return;
    pushHistory({
      category: categoryForAlert(task),
      bedCode: task.bedCode ?? '',
      bedName: task.bedName ?? '-',
      label: `恢复显示：${task.title}`,
      roomName: task.roomName,
    });
  }

  function reloadAlertAckRecords() {
    alertAckRecords.value = loadAlertAckRecords();
  }

  async function setCallAlertsEnabled(enabled: boolean) {
    callAlertsEnabled.value = enabled;
    if (enabled) {
      await enableSwpCallAlerts();
      await notifyNewSwpCalls(swpEvents.value);
    }
    else {
      disableSwpCallAlerts();
    }
  }

  function reloadCallAlertsEnabled() {
    callAlertsEnabled.value = loadSwpCallAlertsEnabled();
  }

  function openAlertTask(taskId: string) {
    const task = alertTasks.value.find(item => item.id === taskId);
    if (!task)
      return;
    if (alertLocateNoticeTimer) {
      clearTimeout(alertLocateNoticeTimer);
      alertLocateNoticeTimer = null;
    }
    alertLocateNotice.value = null;
    const target = area.value
      ? resolveAlertTargetInArea(task, area.value)
      : resolveNextAlertTarget(task);
    if (target.sceneType === 'nurse-station') {
      clearAlertFocusSelection();
      setSceneType('nurse-station');
      alertLocateNotice.value = '暂无法匹配对应病房或床位，请核对设备编码';
      alertLocateNoticeTimer = setTimeout(() => {
        alertLocateNotice.value = null;
        alertLocateNoticeTimer = null;
      }, 4_000);
      return;
    }
    if (target.sceneType === 'ward-interior') {
      enterRoom(target.roomIndex);
      if (target.bedCode)
        focusAlertBed(task);
      else
        clearAlertFocusSelection();
      return;
    }

    clearAlertFocusSelection();
    sceneType.value = 'ward';
    currentRoomIndex.value = target.roomIndex;
    selectedBedCode.value = null;
  }

  function setBedCalling(expectedAreaId: number | null, bedCode: string, calling: boolean) {
    if (!area.value || selectedAreaId.value !== expectedAreaId)
      return false;

    for (const room of area.value.rooms) {
      const bed = room.beds.find(b => b.bedCode === bedCode);
      if (bed) {
        bed.isCalling = calling;
        pushHistory({
          category: 'call',
          bedCode,
          bedName: bed.bedName,
          label: calling ? '床位呼叫' : '呼叫解除',
          roomName: room.sickroomName,
        });
        return true;
      }
    }
    return false;
  }

  function selectBed(bed: TwinBedEntity) {
    clearAlertFocusSelection();
    selectedBedCode.value = bed.bedCode;
  }

  function clearSelection() {
    clearAlertFocusSelection();
    selectedBedCode.value = null;
  }

  function setCameraPreset(preset: CameraPresetId) {
    cameraPreset.value = preset;
  }

  function updateBedStatus(expectedAreaId: number | null, bedCode: string, statusBarInfo: StatusBarInfo) {
    if (!area.value || selectedAreaId.value !== expectedAreaId)
      return false;

    for (const room of area.value.rooms) {
      const bed = room.beds.find(b => b.bedCode === bedCode || b.deviceCode === statusBarInfo.deviceCode);
      if (bed) {
        bed.statusBarInfo = { ...bed.statusBarInfo, ...statusBarInfo, bedCode: bed.bedCode };
        return true;
      }
    }
    return false;
  }

  function updateEnv(expectedAreaId: number | null, sickroomId: string, envData: DoorEnvParams) {
    if (!area.value || selectedAreaId.value !== expectedAreaId)
      return false;
    const room = area.value.rooms.find(item =>
      String(item.sickroomId || item.deviceCode) === sickroomId,
    );
    if (!room)
      return false;
    room.doorEnvData = envData;
    return true;
  }

  function pushHistory(entry: Omit<StatusHistoryEntry, 'id' | 'time'>) {
    statusHistory.value.unshift({
      ...entry,
      id: `${Date.now()}-${historySequence += 1}-${entry.bedCode || 'env'}`,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    });
    if (statusHistory.value.length > MAX_HISTORY)
      statusHistory.value.length = MAX_HISTORY;
  }

  function resetSwpEventState() {
    swpEvents.value = [];
    swpResponseMetrics.value = emptySwpResponseMetrics();
    swpEventSync.value = { phase: 'idle', lastSyncedAt: null, error: null, warning: null };
    swpResponseSync.value = { phase: 'idle', lastSyncedAt: null, error: null, warning: null };
  }

  function beginSwpEventSync(expectedAreaId: number) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    swpEventSync.value = {
      ...swpEventSync.value,
      phase: 'loading',
      error: null,
    };
    return true;
  }

  function applySwpEventSnapshot(
    expectedAreaId: number,
    snapshot: {
      events: NormalizedSwpEvent[];
      refreshedSources?: SwpEventSource[];
      syncedAt?: string;
      warning?: string;
    },
  ) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    const refreshedSources = new Set(snapshot.refreshedSources ?? ['swp-call', 'swp-alarm']);
    const nextEvents = [
      ...swpEvents.value.filter(event => !refreshedSources.has(event.source)),
      ...snapshot.events,
    ];
    const previousIds = new Set(swpEvents.value.map(event => event.id));
    for (const event of [...nextEvents].reverse()) {
      if (previousIds.has(event.id))
        continue;
      pushHistory({
        category: event.taskType === 'call' ? 'call' : 'infusion',
        bedCode: event.location?.bedCode ?? '',
        bedName: event.location?.bedName ?? '-',
        label: event.title,
        roomName: event.location?.roomName ?? event.locationLabel,
      });
    }
    swpEvents.value = nextEvents;
    void notifyNewSwpCalls(nextEvents);
    swpEventSync.value = {
      phase: snapshot.warning ? 'partial' : 'ready',
      lastSyncedAt: snapshot.syncedAt ?? new Date().toISOString(),
      error: null,
      warning: snapshot.warning ?? null,
    };
    return true;
  }

  function failSwpEventSync(expectedAreaId: number, message: string) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    swpEventSync.value = {
      ...swpEventSync.value,
      phase: 'error',
      error: message,
      warning: null,
    };
    return true;
  }

  function beginSwpResponseSync(expectedAreaId: number) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    swpResponseSync.value = {
      ...swpResponseSync.value,
      phase: 'loading',
      error: null,
    };
    return true;
  }

  function applySwpResponseMetrics(
    expectedAreaId: number,
    metrics: SwpResponseMetrics,
    syncedAt: string,
  ) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    swpResponseMetrics.value = metrics;
    swpResponseSync.value = {
      phase: 'ready',
      lastSyncedAt: syncedAt,
      error: null,
      warning: null,
    };
    return true;
  }

  function failSwpResponseSync(expectedAreaId: number, message: string) {
    if (selectedAreaId.value !== expectedAreaId || !area.value)
      return false;
    swpResponseSync.value = {
      ...swpResponseSync.value,
      phase: 'error',
      error: message,
      warning: null,
    };
    return true;
  }

  function stopRemoteServiceInstances() {
    stopRealtimeChannel();
    stopEnvFetcher();
    stopRemoteAreaFetcher();
    stopSwpEventPoller();
  }

  function startRemoteServices() {
    remoteServiceOperationGuard.begin();
    stopRemoteServiceInstances();
    const store = useTwinStore();
    startRealtimeChannel(store);
    if (dataSource.value === 'remote')
      startEnvFetcher(store);
    startRemoteAreaFetcher(store);
    if (dataSource.value === 'remote')
      void startSwpEventPoller(store);
  }

  function stopRemoteServices() {
    const operationToken = remoteServiceOperationGuard.begin();
    stopRemoteServiceInstances();
    return operationToken;
  }

  function clearSessionState() {
    stopSimulation();
    stopRemoteServices();
    areaListRequestGuard.begin();
    areaRequestGuard.begin();
    refreshLoadingGuard.begin();
    clearAreaDiscoveryCache();
    clearTemplateCache();
    clearBedTemplateIdCache();
    bedDetailsRequestGeneration += 1;

    area.value = null;
    areaOptions.value = [];
    selectedAreaId.value = null;
    pendingAreaId.value = null;
    preferredAreaId.value = null;
    rememberedAreaId.value = null;
    isAreaListLoading.value = false;
    isAreaSwitching.value = false;
    areaListError.value = null;
    areaSwitchError.value = null;
    currentRoomIndex.value = -1;
    clearAlertFocusSelection();
    selectedBedCode.value = null;
    sceneType.value = 'nurse-station';
    wardInteriorView.value = '3d';
    cameraPreset.value = 'free';
    isLoading.value = false;
    error.value = null;
    statusHistory.value = [];
    resetSwpEventState();
    deviceCodes.value = [];
    lastFetchedAt.value = null;
    lastFetchedAtMs.value = null;
    dataWarnings.value = [];
    dataPhase.value = 'idle';
    hospitalInfo.value = null;
    hospitalInfoLoading.value = false;
    bedDetailsLoading.value = false;
    bedDetailsError.value = null;
    selectionGeneration += 1;
  }

  function startSimulation() {
    if (dataSource.value !== 'mock')
      return;
    if (isSimulating.value)
      return;
    isSimulating.value = true;
    const store = useTwinStore();
    startStatusPusher(store);
    startCallPusher(store);
    if (dataSource.value === 'mock')
      startEnvSimulator(store);
  }

  function stopSimulation() {
    isSimulating.value = false;
    stopStatusPusher();
    stopCallPusher();
    stopEnvSimulator();
  }

  function toggleSimulation() {
    if (isSimulating.value)
      stopSimulation();
    else
      startSimulation();
  }

  async function reset() {
    stopSimulation();
    const resetAreaId = selectedAreaId.value;
    const operationToken = remoteServiceOperationGuard.begin();
    stopRemoteServiceInstances();
    statusHistory.value = [];
    if (dataSource.value === 'remote' || dataSource.value === 'database') {
      if (dataSource.value === 'remote')
        clearAreaDiscoveryCache();
      await refreshCurrentArea();
    }
    else {
      await loadArea();
    }
    if (
      dataSource.value === 'remote'
      && remoteServiceOperationGuard.isCurrent(operationToken)
      && selectedAreaId.value === resetAreaId
      && !isAreaSwitching.value
    )
      startRemoteServices();
    else if (dataSource.value === 'mock')
      startSimulation();
  }

  return {
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
    currentRoomIndex,
    currentWard,
    selectedBedCode,
    selectedBed,
    selectedStatus,
    currentEnvAlert,
    roomSummaries,
    sceneType,
    wardInteriorView,
    isNurseStation,
    isWard,
    isWardInterior,
    cameraPreset,
    isSimulating,
    isLoading,
    error,
    statusHistory,
    dataSource,
    deviceCodes,
    lastFetchedAt,
    lastFetchedAtMs,
    dataWarnings,
    dataPhase,
    hospitalInfo,
    hospitalInfoLoading,
    bedDetailsLoading,
    bedDetailsError,
    alertTasks,
    hiddenAlertTasks,
    alertStats,
    activeAlertTask,
    alertAckRecords,
    alertLocateNotice,
    callAlertsEnabled,
    swpEvents,
    swpResponseMetrics,
    swpEventSync,
    swpResponseSync,
    setAlertOperator,
    loadAreaOptions,
    enterArea,
    switchArea,
    refreshCurrentArea,
    loadArea,
    startRemoteServices,
    stopRemoteServices,
    clearSessionState,
    setSceneType,
    setWardInteriorView,
    setRoomIndex,
    expandToCorridor,
    resetAreaToStation,
    focusRoom,
    enterRoom,
    setBedCalling,
    selectBed,
    clearSelection,
    setCameraPreset,
    updateBedStatus,
    updateEnv,
    beginSwpEventSync,
    applySwpEventSnapshot,
    failSwpEventSync,
    beginSwpResponseSync,
    applySwpResponseMetrics,
    failSwpResponseSync,
    markAlertHandling,
    resolveAlertTask,
    restoreAlertTask,
    reloadAlertAckRecords,
    setCallAlertsEnabled,
    reloadCallAlertsEnabled,
    openAlertTask,
    pushHistory,
    startSimulation,
    stopSimulation,
    toggleSimulation,
    reset,
  };
});
