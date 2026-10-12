import { computed, createApp, h, ref } from 'vue';
import NurseStationPanel from '../../src/components/NurseStationPanel.vue';
import { buildNurseStationViewModel } from '../../src/core/nurse-station-view-model.ts';
import { summarizeArea } from '../../src/core/area-summary.ts';
import '../../src/styles/global.scss';
import '../../src/styles/dashboard-theme.scss';
import './nurse-warm-sidebar.scss';

const SYNTHETIC_AREA_ID = 999999;

function createSnapshot() {
  const nowMs = Date.now();
  const syncedAt = new Date(nowMs).toISOString();
  /** @type {import('../../src/types/twin.ts').TwinAreaEntity} */
  const area = {
    areaName: '演示病区 · 合成数据',
    areaCode: 'WARM-THEME-DEMO',
    deptName: '主题对照演示',
    rooms: Array.from({ length: 4 }, (_, roomIndex) => ({
      sickroomCode: `DEMO-ROOM-${roomIndex + 1}`,
      sickroomName: `演示 ${String(roomIndex + 1).padStart(2, '0')} 房`,
      sickroomId: `DEMO-ROOM-${roomIndex + 1}`,
      deviceCode: `DEMO-DOOR-${roomIndex + 1}`,
      isOnline: true,
      doorEnvData: { temp: 23.6 + roomIndex * 0.2, relativeHumid: '48', airQuality: '36', noiseLevel: '38' },
      envSync: { lastSuccessAt: nowMs, failed: false },
      beds: Array.from({ length: 4 }, (_, bedIndex) => ({
        bedCode: `DEMO-BED-${roomIndex + 1}-${bedIndex + 1}`,
        bedName: `${String(roomIndex * 4 + bedIndex + 1).padStart(2, '0')} 床`,
        deviceCode: `DEMO-DEVICE-${roomIndex + 1}-${bedIndex + 1}`,
        position: { x: bedIndex % 2 ? 1 : -1, z: Math.floor(bedIndex / 2) },
        isOccupied: roomIndex * 4 + bedIndex < 13,
        isOnline: true,
      })),
    })),
  };
  /** @type {Array<{ type: 'call' | 'vital', title: string, severity: 'critical' | 'high' }>} */
  const samples = [
    { type: 'call', title: '演示呼叫', severity: 'critical' },
    { type: 'vital', title: '演示体征预警', severity: 'high' },
  ];
  const tasks = samples.map((entry, index) => {
    const room = area.rooms[index];
    const bed = room.beds[0];
    /** @type {import('../../src/core/alert-workflow.ts').AlertTask} */
    const task = {
      ...entry,
      id: `WARM-DEMO-EVENT-${index + 1}`,
      source: 'swp-call',
      status: 'pending',
      roomIndex: index,
      roomCode: room.sickroomCode,
      roomName: room.sickroomName,
      bedCode: bed.bedCode,
      bedName: bed.bedName,
      description: '合成测试事件，仅用于主题与布局对照。',
      startedAt: new Date(nowMs - (index + 1) * 60_000).toISOString(),
      actionText: '定位',
      canLocate: true,
      locationStatus: 'matched',
      locationSource: 'bed-code',
    };
    return task;
  });
  /** @type {import('../../src/types/swp-events.ts').NormalizedSwpEvent[]} */
  const events = tasks.map(task => ({
    id: task.id,
    source: 'swp-call',
    areaId: SYNTHETIC_AREA_ID,
    taskType: task.type === 'vital' ? 'vital' : 'call',
    severity: task.severity === 'critical' ? 'critical' : 'high',
    startedAt: task.startedAt,
    timestampMs: Date.parse(task.startedAt ?? syncedAt),
    title: task.title,
    description: task.description,
    location: {
      roomIndex: task.roomIndex,
      roomCode: task.roomCode,
      roomName: task.roomName,
      bedCode: task.bedCode,
      bedName: task.bedName,
    },
    locationStatus: 'matched',
    locationSource: 'bed-code',
    locationLabel: `${task.roomName} · ${task.bedName}`,
  }));
  /** @type {import('../../src/types/inspection.ts').InspectionRoomSummary[]} */
  const inspections = area.rooms.map((room, roomIndex) => ({
    roomIndex,
    roomCode: room.sickroomCode,
    roomName: room.sickroomName,
    state: roomIndex === 2 ? 'due' : 'normal',
    stateLabel: roomIndex === 2 ? '待关注' : '已巡视',
    latestAt: syncedAt,
    latestNurseName: '演示护士',
    overdueCount: 0,
    dueCount: roomIndex === 2 ? 1 : 0,
    normalCount: roomIndex === 2 ? 0 : 1,
    records: [],
  }));
  return { area, tasks, events, inspections, nowMs, syncedAt };
}

/**
 * Mounts the production sidebar with an isolated synthetic snapshot.
 * The host supplies the width/height; all interactions remain in memory.
 * @param {HTMLElement} host
 * @param {'light' | 'dark'} [initialTheme]
 * @returns {{ setTheme(theme: 'light' | 'dark'): void, dispose(): void }}
 */
export function mountWarmSidebar(host, initialTheme = 'light') {
  if (!(host instanceof HTMLElement)) throw new TypeError('侧栏挂载容器必须是 HTML 元素');
  const snapshot = createSnapshot();
  const theme = ref(initialTheme === 'dark' ? 'dark' : 'light');
  const tasks = ref(snapshot.tasks);
  const wallboard = ref(false);
  const callAlertsEnabled = ref(false);
  const feedback = ref('所有数字均为合成数据，操作仅在此预览内生效。');
  /** @type {import('vue').Ref<import('../../src/core/alert-ack.ts').AlertAckRecordMap>} */
  const acknowledgements = ref({});
  /** @type {import('../../src/types/swp-events.ts').SwpEventSyncState} */
  const sync = { phase: 'ready', lastSyncedAt: snapshot.syncedAt, error: null, warning: null };
  const viewModel = computed(() => buildNurseStationViewModel({
    // A null ID keeps the production record-query button disabled: no API can be queried.
    areaId: null,
    dataSource: 'mock',
    area: snapshot.area,
    roomSummaries: summarizeArea(snapshot.area.rooms),
    alertTasks: tasks.value,
    swpEvents: snapshot.events,
    swpEventSync: sync,
    swpResponseSync: sync,
    inspectionSync: sync,
    inspectionRoomSummaries: snapshot.inspections,
    swpResponseMetrics: {
      callCount: 6,
      arrivedCallCount: 5,
      unattendedCallCount: 1,
      arrivalCount: 5,
      averageResponseSeconds: 42,
      latestCallAt: snapshot.syncedAt,
    },
    wardDataStatus: 'ready',
    wardDataSyncedAtMs: snapshot.nowMs,
    nowMs: snapshot.nowMs,
  }));
  /** Confirmation is local attention, not recovery of a source-managed clinical event. */
  function confirmTask(taskId) {
    const task = tasks.value.find(item => item.id === taskId);
    if (!task) return;
    acknowledgements.value = {
      ...acknowledgements.value,
      [taskId]: { taskId, status: 'handling', eventStartedAt: task.startedAt,
        operator: '演示操作员', updatedAt: new Date().toISOString(), syncState: 'local' },
    };
    tasks.value = tasks.value.map(item => item.id === taskId ? { ...item, status: 'handling' } : item);
    feedback.value = `${task.title}：已在本地确认关注，源事件仍保留。`;
  }
  const app = createApp({
    setup() {
      return () => h('section', {
        class: 'digital-twin warm-sidebar',
        'data-theme': theme.value,
        'aria-label': '演示病区侧栏，所有数据均为合成数据',
      }, [
        h('div', { class: 'warm-sidebar__notice' }, [
          h('strong', '合成数据 · 主题对照'),
          h('span', { role: 'status', 'aria-live': 'polite' }, feedback.value),
        ]),
        h('div', { class: 'warm-sidebar__panel' }, [
          h(NurseStationPanel, {
            viewModel: viewModel.value,
            alertAckRecords: acknowledgements.value,
            statusHistory: [],
            wallboard: wallboard.value,
            callAlertsEnabled: callAlertsEnabled.value,
            onSetWallboard: enabled => { wallboard.value = enabled; },
            onSetCallAlertsEnabled: enabled => {
              callAlertsEnabled.value = enabled;
              feedback.value = `演示提醒${enabled ? '已开启' : '已关闭'}，仅记录开关状态。`;
            },
            onFocusRoom: index => {
              const room = snapshot.area.rooms[index];
              if (room) feedback.value = `本地已选择 ${room.sickroomName}。`;
            },
            onLocateAlert: taskId => {
              const task = tasks.value.find(item => item.id === taskId);
              if (task) feedback.value = `演示定位：${task.roomName} · ${task.bedName}。`;
            },
            onMarkAlertHandling: confirmTask,
            onAcknowledgeAlert: confirmTask,
          }),
        ]),
      ]);
    },
  });
  app.mount(host);
  let disposed = false;
  return {
    setTheme(value) {
      if (!disposed) theme.value = value === 'dark' ? 'dark' : 'light';
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      app.unmount();
    },
  };
}
