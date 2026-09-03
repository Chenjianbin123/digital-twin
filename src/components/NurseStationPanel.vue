<script setup lang="ts">
import { computed } from "vue";
import AlertTaskPanel from "@/components/AlertTaskPanel.vue";
import DoorStaffCards from "@/components/DoorStaffCards.vue";
import DashSectionHeader from "@/components/dashboard/DashSectionHeader.vue";
import type { AlertAckRecordMap } from "@/core/alert-ack";
import type { RoomPriority, RoomSummary } from "@/core/area-summary";
import type { AlertTask } from "@/core/alert-workflow";
import { buildDataHealthSummary, type DataStatus } from "@/core/data-status";
import {
  buildNurseStationLiveData,
  buildShiftHandoffSummary,
} from "@/core/nurse-station-live-data";
import type {
  NormalizedSwpEvent,
  SwpEventSyncState,
  SwpResponseMetrics,
} from "@/types/swp-events";
import type {
  InspectionRoomSummary,
  InspectionSyncState,
} from "@/types/inspection";
import type {
  StatusHistoryEntry,
  TwinAreaEntity,
  TwinWardEntity,
} from "@/types/twin";

const props = defineProps<{
  area: TwinAreaEntity;
  roomSummaries: RoomSummary[];
  statusHistory?: StatusHistoryEntry[];
  deviceCount?: number;
  alertTasks?: AlertTask[];
  hiddenAlertTasks?: AlertTask[];
  alertAckRecords?: AlertAckRecordMap;
  callAlertsEnabled?: boolean;
  swpEvents?: NormalizedSwpEvent[];
  swpResponseMetrics?: SwpResponseMetrics;
  swpEventSync?: SwpEventSyncState;
  swpResponseSync?: SwpEventSyncState;
  inspectionRoomSummaries?: InspectionRoomSummary[];
  inspectionSync?: InspectionSyncState;
  wardDataStatus?: DataStatus;
}>();

const emit = defineEmits<{
  focusRoom: [index: number];
  locateAlert: [taskId: string];
  markAlertHandling: [taskId: string];
  resolveAlert: [taskId: string];
  restoreAlert: [taskId: string];
  setCallAlertsEnabled: [enabled: boolean];
}>();

const primaryWard = computed<TwinWardEntity | null>(
  () => props.area.rooms[0] ?? null,
);
const stationSubtitle = computed(() =>
  [props.area.areaName, props.area.deptName].filter(Boolean).join(" · "),
);

const metrics = computed(() => {
  const live = buildNurseStationLiveData(
    props.area,
    props.roomSummaries,
    props.deviceCount,
  );
  const callKeys = new Set<string>();
  for (const room of props.area.rooms) {
    for (const bed of room.beds) {
      if (bed.isCalling)
        callKeys.add(`bed:${room.sickroomCode}:${bed.bedCode}`);
    }
  }
  for (const event of props.swpEvents ?? []) {
    if (event.taskType !== "call") continue;
    callKeys.add(
      event.location?.bedCode
        ? `bed:${event.location.roomCode}:${event.location.bedCode}`
        : `event:${event.id}`,
    );
  }
  return {
    ...live,
    occupied: live.occupiedBeds,
    empty: live.emptyBeds,
    calling: callKeys.size,
    offlineBeds: live.offlineBedCount,
    envWarnings: live.envWarningCount,
  };
});
const occupancyRate = computed(() => {
  const { occupied, totalBeds } = metrics.value;
  if (!totalBeds) return null;
  return Math.round((occupied / totalBeds) * 100);
});

const loadLabel = computed(() => {
  if (!metrics.value.totalBeds) return "待同步";
  const rate = occupancyRate.value ?? 0;
  if (rate >= 85) return "高负载";
  if (rate >= 60) return "平稳";
  return "宽松";
});

const stationKpis = computed(() => [
  {
    key: "occupied",
    label: "在院",
    value: metrics.value.occupied,
    unit: "人",
    tone: "cyan",
  },
  {
    key: "empty",
    label: "空床",
    value: metrics.value.empty,
    unit: "床",
    tone: "blue",
  },
  {
    key: "calls",
    label: "呼叫",
    value: metrics.value.calling,
    unit: "项",
    tone: metrics.value.calling ? "alert" : "green",
  },
  {
    key: "infusing",
    label: "输液巡视",
    value: metrics.value.infusingCount,
    unit: "床",
    tone: metrics.value.infusingCount ? "infusion" : "green",
  },
  {
    key: "online",
    label: "在线设备",
    value: metrics.value.deviceOnline,
    unit: "台",
    tone: metrics.value.offlineBeds ? "warn" : "green",
  },
]);

const deviceAttentionDetail = computed(() => {
  const parts = [
    metrics.value.offlineDeviceCount
      ? `${metrics.value.offlineDeviceCount} 台设备离线`
      : "",
    metrics.value.lowBatteryDeviceCount
      ? `${metrics.value.lowBatteryDeviceCount} 台设备低电量`
      : "",
  ].filter(Boolean);
  return parts.length ? parts.join("，") : "设备链路正常";
});

const operationRows = computed(() => {
  const waitingTasks = props.alertTasks
    ? props.alertTasks.filter((task) => task.type !== "infusion").length +
      (props.hiddenAlertTasks?.filter((task) => task.type !== "infusion")
        .length ?? 0)
    : metrics.value.calling +
      metrics.value.offlineBeds +
      metrics.value.envWarnings;
  const pressure = Math.min(100, waitingTasks * 18);

  return [
    {
      key: "occupancy",
      label: "床位占用",
      value: occupancyRate.value == null ? "待同步" : `${occupancyRate.value}%`,
      sub: `${metrics.value.occupied}/${metrics.value.totalBeds} 在院`,
      percent: occupancyRate.value ?? 0,
      tone:
        occupancyRate.value != null && occupancyRate.value > 85
          ? "warn"
          : "cyan",
    },
    {
      key: "device",
      label: "设备在线率",
      value: `${metrics.value.deviceHealthRate}%`,
      sub: `${metrics.value.deviceOnline}/${metrics.value.deviceTotal} 台在线`,
      percent: metrics.value.deviceHealthRate ?? 0,
      tone: metrics.value.offlineBeds ? "warn" : "green",
    },
    {
      key: "pressure",
      label: "响应压力",
      value: waitingTasks ? `${waitingTasks} 项` : "低",
      sub: metrics.value.calling
        ? "存在床位呼叫"
        : metrics.value.infusingCount
          ? `${metrics.value.infusingCount} 床输液待巡视`
          : "无紧急呼叫",
      percent: pressure,
      tone: waitingTasks ? "alert" : "blue",
    },
  ];
});

const responseMetrics = computed<SwpResponseMetrics>(
  () =>
    props.swpResponseMetrics ?? {
      callCount: 0,
      arrivedCallCount: 0,
      unattendedCallCount: 0,
      arrivalCount: 0,
      averageResponseSeconds: null,
      latestCallAt: null,
    },
);

function formatResponseDuration(seconds: number | null) {
  if (seconds == null) return "--";
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return remain ? `${minutes}分${remain}秒` : `${minutes}分钟`;
}

const responseCards = computed(() => [
  {
    key: "average",
    label: "平均响应",
    value: formatResponseDuration(responseMetrics.value.averageResponseSeconds),
  },
  {
    key: "arrived",
    label: "已到场呼叫",
    value: `${responseMetrics.value.arrivedCallCount}/${responseMetrics.value.callCount}`,
  },
  {
    key: "unattended",
    label: "未到场",
    value: String(responseMetrics.value.unattendedCallCount),
  },
]);

const eventSourceLabel = computed(() => {
  if (props.swpEventSync?.phase === "error") return "呼叫数据异常";
  if (props.swpEventSync?.phase === "partial") return "呼叫数据部分同步";
  if (props.swpEventSync?.phase === "loading")
    return props.swpEventSync.lastSyncedAt
      ? "呼叫数据刷新中"
      : "呼叫数据同步中";
  if (props.swpEventSync?.phase === "ready") return "呼叫数据已同步";
  return "等待呼叫数据";
});

const eventSourceDetail = computed(() => {
  if (props.swpEventSync?.phase === "error")
    return props.swpEventSync.lastSyncedAt
      ? "当前显示最近一次数据"
      : "暂未获取到呼叫数据";
  if (props.swpEventSync?.phase === "partial")
    return "部分呼叫数据可能延迟，请关注管理机或话机";
  if (props.swpEventSync?.phase === "loading") return "正在更新呼叫列表";
  if (!props.swpEventSync?.lastSyncedAt) return "等待护士站呼叫数据";
  return `最近同步 ${new Date(props.swpEventSync.lastSyncedAt).toLocaleTimeString("zh-CN", { hour12: false })}`;
});

const shiftHandoff = computed(() =>
  buildShiftHandoffSummary(props.alertTasks ?? [], props.swpEventSync),
);

const dataHealth = computed(() =>
  buildDataHealthSummary({
    wardStatus: props.wardDataStatus ?? "loading",
    eventSync: props.swpEventSync ?? {
      phase: "idle",
      lastSyncedAt: null,
      error: null,
      warning: null,
    },
  }),
);

const displayedStationState = computed(() => {
  if (
    metrics.value.state.level !== "normal" ||
    dataHealth.value.canDeclareNormal
  )
    return metrics.value.state;
  return {
    level: "attention" as const,
    label: "数据需复核",
    message: "数据未完全同步，暂不能判断病区运行正常",
  };
});

const statusTone = computed(() =>
  displayedStationState.value.level === "urgent"
    ? "alert"
    : displayedStationState.value.level === "attention"
      ? "warn"
      : "ok",
);

const statusModeLabel = computed(() => {
  if (statusTone.value === "alert") return "需要立即处理";
  if (statusTone.value === "warn") return "需要复核";
  return "系统运行正常";
});

const displayedShiftHandoff = computed(() => {
  if (dataHealth.value.canDeclareNormal || (props.alertTasks?.length ?? 0) > 0)
    return shiftHandoff.value;
  return {
    level: "attention" as const,
    title: "交班数据需复核",
    items: [
      "数据未完全同步，暂不能确认本班无待交接事项",
      "请结合管理机、话机和现场设备确认",
    ],
  };
});

function dataHealthStatusLabel(status: DataStatus) {
  if (status === "ready") return "正常";
  if (status === "loading") return "同步中";
  if (status === "warning") return "部分同步";
  if (status === "stale") return "已延迟";
  return "中断";
}

const responseSourceLabel = computed(() => {
  if (props.swpResponseSync?.phase === "error") return "指标同步异常";
  if (props.swpResponseSync?.phase === "loading")
    return props.swpResponseSync.lastSyncedAt ? "指标刷新中" : "指标同步中";
  if (props.swpResponseSync?.phase === "ready") return "指标已同步";
  return "指标待同步";
});

const responseSourceDetail = computed(() => {
  if (props.swpResponseSync?.error) return props.swpResponseSync.error;
  if (!props.swpResponseSync?.lastSyncedAt) return "等待响应时效数据";
  return `最近同步 ${new Date(props.swpResponseSync.lastSyncedAt).toLocaleTimeString("zh-CN", { hour12: false })}`;
});

const inspectionOverview = computed(() => {
  const summaries = props.inspectionRoomSummaries ?? [];
  return {
    normal: summaries.filter(item => item.state === "normal").length,
    due: summaries.filter(item => item.state === "due").length,
    overdue: summaries.filter(item => item.state === "overdue").length,
    noRecord: summaries.filter(item => item.state === "no-record").length,
  };
});

const inspectionAttentionRooms = computed(() =>
  (props.inspectionRoomSummaries ?? [])
    .filter(item => item.state === "overdue" || item.state === "due")
    .sort((a, b) => {
      const rank = { overdue: 0, due: 1 };
      return rank[a.state as "overdue" | "due"] - rank[b.state as "overdue" | "due"];
    })
    .slice(0, 3),
);

const inspectionSyncLabel = computed(() => {
  if (props.inspectionSync?.phase === "error")
    return "巡视数据同步异常";
  if (props.inspectionSync?.phase === "loading")
    return props.inspectionSync.lastSyncedAt ? "巡视数据刷新中" : "巡视数据同步中";
  if (props.inspectionSync?.phase === "ready")
    return props.inspectionSync.lastSyncedAt
      ? `数据同步 ${new Date(props.inspectionSync.lastSyncedAt).toLocaleTimeString("zh-CN", { hour12: false })}`
      : "巡视数据已同步";
  return "巡视数据待同步";
});

function inspectionTime(value: string | null) {
  if (!value)
    return "--";
  const match = value.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : value;
}

const PRIORITY_RANK: Record<RoomPriority, number> = {
  calling: 0,
  danger: 1,
  offline: 2,
  infusing: 3,
  warning: 4,
  normal: 5,
  empty: 6,
};

const attentionRooms = computed(() =>
  [...props.roomSummaries]
    .filter((s) => s.priority !== "normal" && s.priority !== "empty")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 5),
);

const overviewRooms = computed(() =>
  [...props.roomSummaries].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  ),
);

const focusRooms = computed(() => {
  if (attentionRooms.value.length) return attentionRooms.value.slice(0, 3);
  return overviewRooms.value.slice(0, 3);
});

function roomPatrolText(room: RoomSummary) {
  const roomTasks = (props.alertTasks ?? []).filter(
    (task) => task.roomCode === room.sickroomCode,
  );
  const urgentTaskCount = roomTasks.filter(
    (task) => task.type !== "infusion",
  ).length;
  const parts = [room.statusText];
  if (urgentTaskCount) parts.push(`待处理 ${urgentTaskCount}`);
  else if (room.infusingCount) parts.push(`待巡视 ${room.infusingCount}`);
  return parts.join(" · ");
}

const recentHistory = computed(() => (props.statusHistory ?? []).slice(0, 3));

const envSnapshot = computed(() => {
  const temps: string[] = [];
  const humids: string[] = [];
  for (const room of props.area.rooms) {
    const env = room.doorEnvData;
    if (env?.temp != null && String(env.temp).trim())
      temps.push(String(env.temp).replace(/℃|°C/g, "").trim());
    if (env?.relativeHumid != null && String(env.relativeHumid).trim())
      humids.push(String(env.relativeHumid).replace(/%/g, "").trim());
  }

  const avg = (values: string[]) => {
    const nums = values.map(Number).filter((n) => !Number.isNaN(n));
    if (!nums.length) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };

  return {
    temp: avg(temps),
    humid: avg(humids),
  };
});

const envCards = computed(() => [
  {
    key: "temp",
    label: "平均温度",
    value: envSnapshot.value.temp == null ? "--" : envSnapshot.value.temp,
    unit: envSnapshot.value.temp == null ? "" : "℃",
  },
  {
    key: "humid",
    label: "平均湿度",
    value: envSnapshot.value.humid == null ? "--" : envSnapshot.value.humid,
    unit: envSnapshot.value.humid == null ? "" : "%",
  },
  {
    key: "env",
    label: "环境预警",
    value: metrics.value.envWarnings,
    unit: "间",
  },
]);

function priorityLabel(priority: RoomPriority) {
  const map: Record<RoomPriority, string> = {
    calling: "呼叫",
    danger: "异常",
    offline: "离线",
    infusing: "输液",
    warning: "预警",
    empty: "空房",
    normal: "正常",
  };
  return map[priority] ?? "正常";
}

function historyCategoryLabel(category: StatusHistoryEntry["category"]) {
  if (category === "env") return "环境";
  if (category === "call") return "呼叫";
  if (category === "device") return "设备";
  return "输液";
}

function handleRoomClick(index: number) {
  emit("focusRoom", index);
}

</script>

<template>
  <section class="nurse-panel" aria-label="护士站工作台">
    <header class="station-hero">
      <span class="station-hero__scanline" aria-hidden="true" />
      <span class="station-hero__grid" aria-hidden="true" />
      <div class="station-hero__top">
        <div class="station-hero__title">
          <span class="station-hero__eyebrow">护士站指挥中心</span>
          <h1>智慧护士站</h1>
          <p v-if="stationSubtitle">{{ stationSubtitle }}</p>
        </div>
        <!-- <div class="station-hero__clock">
          <time>{{ clock.time }}</time>
          <span>{{ clock.date }} · {{ shift.label }}</span>
        </div> -->
      </div>

      <div class="station-hero__body">
        <div class="station-state" :class="`station-state--${statusTone}`">
          <span class="station-state__signal" aria-hidden="true" />
          <strong>当前运行状态</strong>
          <small>{{ statusModeLabel }}</small>
        </div>
        <div class="station-hero__status">
          <div class="station-hero__status-head">
            <span
              :class="`station-hero__badge station-hero__badge--${statusTone}`"
            >
              {{ displayedStationState.label }}
            </span>
            <span class="station-hero__status-live">
              <i aria-hidden="true" />实时数据
            </span>
          </div>
          <p>{{ displayedStationState.message }}</p>
          <div class="station-hero__chips">
            <span class="station-hero__chip station-hero__chip--load">{{
              loadLabel
            }}</span>
            <span class="station-hero__chip station-hero__chip--rooms"
              >{{ metrics.rooms }} 间病房</span
            >
            <span class="station-hero__chip station-hero__chip--devices"
              >{{ metrics.deviceOnline }}/{{ metrics.deviceTotal }} 台在线</span
            >
            <span class="station-hero__chip station-hero__chip--events"
              >真实事件 {{ swpEvents?.length ?? 0 }}</span
            >
            <button
              type="button"
              class="station-hero__alert-toggle"
              :aria-pressed="callAlertsEnabled"
              @click="emit('setCallAlertsEnabled', !callAlertsEnabled)"
            >
              <span class="station-hero__alert-icon" aria-hidden="true" />
              呼叫提醒：{{ callAlertsEnabled ? "已开启" : "未开启" }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <AlertTaskPanel
      :tasks="alertTasks ?? []"
      :ack-records="alertAckRecords"
      :hidden-tasks="hiddenAlertTasks"
      title="优先处理"
      :max-items="4"
      compact
      @locate="emit('locateAlert', $event)"
      @mark-handling="emit('markAlertHandling', $event)"
      @resolve="emit('resolveAlert', $event)"
      @restore="emit('restoreAlert', $event)"
    />

    <section class="inspection-overview">
      <div class="inspection-overview__head">
        <div>
          <span>巡视总览</span>
          <strong>真实巡视记录</strong>
        </div>
        <small>{{ inspectionSyncLabel }}</small>
      </div>
      <div class="inspection-overview__metrics">
        <article class="inspection-metric inspection-metric--normal">
          <span>已巡视</span>
          <strong>{{ inspectionOverview.normal }}</strong>
          <small>间病房</small>
        </article>
        <article class="inspection-metric inspection-metric--due">
          <span>待关注</span>
          <strong>{{ inspectionOverview.due }}</strong>
          <small>间病房</small>
        </article>
        <article class="inspection-metric inspection-metric--overdue">
          <span>巡视超时</span>
          <strong>{{ inspectionOverview.overdue }}</strong>
          <small>间病房</small>
        </article>
      </div>
      <ul v-if="inspectionAttentionRooms.length" class="inspection-overview__rooms">
        <li v-for="room in inspectionAttentionRooms" :key="room.roomCode">
          <button type="button" @click="handleRoomClick(room.roomIndex)">
            <span>
              <strong>{{ room.roomName }}</strong>
              <small>
                {{ room.latestNurseName || "巡视人员待同步" }}
                · {{ inspectionTime(room.latestAt) }}
              </small>
            </span>
            <em :class="`is-${room.state}`">{{ room.stateLabel }}</em>
          </button>
        </li>
      </ul>
      <p v-else-if="inspectionOverview.noRecord">
        {{ inspectionOverview.noRecord }} 间病房暂无巡视记录，等待数据同步。
      </p>
      <p v-else>当前没有巡视超时或待关注病房。</p>
    </section>

    <section
      class="handoff-card"
      :class="`handoff-card--${displayedShiftHandoff.level}`"
    >
      <div class="handoff-card__head">
        <span>护理交班</span>
        <strong>{{ displayedShiftHandoff.title }}</strong>
      </div>
      <ul>
        <li v-for="item in displayedShiftHandoff.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>

    <section class="data-health" :class="`data-health--${dataHealth.level}`">
      <div class="data-health__head">
        <span>数据健康</span>
        <strong>{{ dataHealth.label }}</strong>
      </div>
      <ul>
        <li v-for="item in dataHealth.items" :key="item.key">
          <span>{{ item.label }}</span>
          <strong :class="`data-health__status--${item.status}`">{{
            dataHealthStatusLabel(item.status)
          }}</strong>
          <small>{{ item.detail }}</small>
        </li>
      </ul>
      <p v-if="!dataHealth.canDeclareNormal">
        数据未完全同步时，不能据此判断病区无异常，请结合现场设备确认。
      </p>
    </section>

    <section class="kpi-grid" aria-label="护士站核心指标">
      <article
        v-for="item in stationKpis"
        :key="item.key"
        class="kpi-card"
        :class="`kpi-card--${item.tone}`"
      >
        <span class="kpi-card__label">{{ item.label }}</span>
        <strong
          >{{ item.value }}<small>{{ item.unit }}</small></strong
        >
      </article>
    </section>

    <section
      v-if="focusRooms.length"
      class="surface-panel surface-panel--focus"
    >
      <DashSectionHeader
        :title="attentionRooms.length ? '重点病房' : '病房巡视'"
        :count="focusRooms.length"
      />
      <ul class="focus-list">
        <li
          v-for="room in focusRooms"
          :key="`${room.sickroomCode}-${room.roomIndex}`"
        >
          <button
            type="button"
            class="focus-room"
            :class="`focus-room--${room.priority}`"
            :aria-label="`进入走廊并定位${room.sickroomName}`"
            @click="handleRoomClick(room.roomIndex)"
          >
            <span
              class="focus-room__bar"
              :style="{ backgroundColor: room.accentColor }"
            />
            <span class="focus-room__main">
              <strong>{{ room.sickroomName }}</strong>
              <span>{{ roomPatrolText(room) }}</span>
            </span>
            <span class="focus-room__side">
              <em>{{ priorityLabel(room.priority) }}</em>
              <span>{{ room.occupiedBeds }}/{{ room.totalBeds }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <details class="nurse-panel__details">
      <summary>运行详情</summary>
      <div class="nurse-panel__details-body">
        <section class="surface-panel">
          <DashSectionHeader title="运行态势" />
          <div class="ops-list">
            <div
              v-for="row in operationRows"
              :key="row.key"
              class="ops-row"
              :class="`ops-row--${row.tone}`"
            >
              <div class="ops-row__head">
                <span>{{ row.label }}</span
                ><strong>{{ row.value }}</strong>
              </div>
              <div class="ops-row__track">
                <i
                  :style="{
                    width: `${Math.max(row.percent, row.percent > 0 ? 5 : 0)}%`,
                  }"
                />
              </div>
              <p>{{ row.sub }}</p>
            </div>
          </div>
        </section>

        <section class="surface-panel surface-panel--env">
          <DashSectionHeader title="设备与环境" />
          <div class="env-grid">
            <article v-for="item in envCards" :key="item.key" class="env-card">
              <span>{{ item.label }}</span
              ><strong
                >{{ item.value }}<small>{{ item.unit }}</small></strong
              >
            </article>
          </div>
          <div class="device-line">
            <span>设备在线口径</span>
            <strong
              >{{ metrics.deviceOnline }}/{{ metrics.deviceTotal }} 台</strong
            >
            <em>{{ deviceAttentionDetail }}</em>
          </div>
        </section>

        <section class="surface-panel surface-panel--response">
          <DashSectionHeader title="呼叫响应（近24小时）" />
          <div class="env-grid">
            <article
              v-for="item in responseCards"
              :key="item.key"
              class="env-card"
            >
              <span>{{ item.label }}</span
              ><strong>{{ item.value }}</strong>
            </article>
          </div>
          <div class="device-line">
            <span>响应指标</span>
            <strong>{{ responseSourceLabel }}</strong>
            <em>{{ responseSourceDetail }}</em>
          </div>
          <div class="device-line">
            <span>实时事件</span>
            <strong>{{ eventSourceLabel }}</strong>
            <em>{{ eventSourceDetail }}</em>
          </div>
        </section>

        <section
          v-if="primaryWard?.doorStaff || primaryWard?.doorDeptUsers?.length"
          class="surface-panel"
        >
          <DashSectionHeader title="值班医护" />
          <DoorStaffCards
            :staff="primaryWard?.doorStaff"
            :dept-users="primaryWard?.doorDeptUsers"
            primary-only
            compact
          />
        </section>

        <section class="surface-panel surface-panel--feed">
          <DashSectionHeader
            title="实时动态"
            :count="recentHistory.length || undefined"
          />
          <ul v-if="recentHistory.length" class="feed">
            <li
              v-for="item in recentHistory"
              :key="item.id"
              class="feed__item"
              :class="`feed__item--${item.category}`"
            >
              <span class="feed__time">{{ item.time }}</span>
              <span class="feed__tag">{{
                historyCategoryLabel(item.category)
              }}</span>
              <span class="feed__text"
                >{{ item.roomName }} {{ item.bedName }} · {{ item.label }}</span
              >
            </li>
          </ul>
          <div v-else class="empty-feed">
            <strong>暂无实时事件</strong
            ><span>系统将持续监听呼叫、输液、环境与设备状态</span>
          </div>
        </section>
      </div>
    </details>
  </section>
</template>

<style scoped lang="scss">
@keyframes nurse-station-hero-scan {
  0%,
  12% {
    opacity: 0;
    transform: translate3d(0, 0, 0) skewX(-18deg);
  }

  24% {
    opacity: 0.72;
  }

  62% {
    opacity: 0.72;
  }

  78%,
  100% {
    opacity: 0;
    transform: translate3d(680%, 0, 0) skewX(-18deg);
  }
}

@keyframes nurse-station-status-pulse {
  0%,
  100% {
    opacity: 0.32;
    transform: scale(0.86);
  }

  50% {
    opacity: 0.95;
    transform: scale(1.08);
  }
}

@keyframes nurse-station-badge-sheen {
  0%,
  18% {
    opacity: 0;
    transform: translate3d(0, 0, 0) skewX(-18deg);
  }

  30% {
    opacity: 0.78;
  }

  58%,
  100% {
    opacity: 0;
    transform: translate3d(360%, 0, 0) skewX(-18deg);
  }
}

@keyframes nurse-station-chip-sheen {
  0%,
  22% {
    opacity: 0;
    transform: translate3d(0, 0, 0) skewX(-18deg);
  }

  34% {
    opacity: 0.62;
  }

  64%,
  100% {
    opacity: 0;
    transform: translate3d(420%, 0, 0) skewX(-18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .station-hero__scanline,
  .station-hero__status-live i,
  .station-hero__badge::after,
  .station-hero__chips > span::after,
  .station-state::before,
  .station-state__signal::before {
    animation: none;
  }
}

.nurse-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(77, 208, 255, 0.28) transparent;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(77, 208, 255, 0.24);
    border-radius: 4px;
  }

  &__details {
    flex-shrink: 0;
    border: 1px solid rgba(111, 196, 193, 0.2);
    border-radius: 7px;
    background: rgba(10, 29, 39, 0.48);

    summary {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      color: rgba(226, 244, 244, 0.9);
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      list-style: none;

      &::after {
        content: "+";
        color: #81d8d1;
        font-size: 18px;
        font-weight: 500;
      }

      &::-webkit-details-marker {
        display: none;
      }
    }

    &[open] summary::after {
      content: "−";
    }

    &-body {
      display: grid;
      gap: 8px;
      padding: 0 8px 8px;
    }
  }
}

.station-hero,
.surface-panel {
  flex-shrink: 0;
  border: 1px solid rgba(96, 210, 255, 0.15);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(12, 34, 54, 0.58), rgba(7, 22, 37, 0.46)),
    rgba(8, 24, 42, 0.42);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.handoff-card {
  flex-shrink: 0;
  padding: 9px 11px;
  border: 1px solid rgba(96, 210, 255, 0.16);
  border-radius: 8px;
  background: linear-gradient(
    135deg,
    rgba(17, 50, 70, 0.64),
    rgba(8, 28, 44, 0.52)
  );

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    span {
      color: rgba(172, 211, 235, 0.76);
      font-size: 11px;
      font-weight: 800;
    }

    strong {
      color: #dff8ff;
      font-size: 12px;
    }
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    padding: 4px 7px;
    border-radius: 5px;
    background: rgba(96, 210, 255, 0.08);
    color: rgba(213, 235, 248, 0.88);
    font-size: 10px;
    line-height: 1.35;
  }

  &--attention {
    border-color: rgba(255, 190, 90, 0.24);

    li {
      background: rgba(255, 176, 56, 0.09);
      color: #ffe0a5;
    }
  }
}

.data-health {
  flex-shrink: 0;
  padding: 9px 11px;
  border: 1px solid rgba(103, 215, 140, 0.18);
  border-radius: 8px;
  background: rgba(8, 31, 42, 0.58);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    span {
      color: rgba(172, 211, 235, 0.76);
      font-size: 11px;
      font-weight: 800;
    }

    strong {
      color: #bdf7c8;
      font-size: 12px;
    }
  }

  ul {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 5px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    min-width: 0;
    padding: 6px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);

    > span,
    > strong,
    > small {
      display: block;
    }

    > span {
      color: rgba(200, 225, 240, 0.82);
      font-size: 10px;
      font-weight: 800;
    }

    > strong {
      margin-top: 4px;
      color: #bdf7c8;
      font-size: 11px;
    }

    > small {
      margin-top: 3px;
      color: rgba(166, 194, 213, 0.68);
      font-size: 9px;
      line-height: 1.3;
    }
  }

  p {
    margin: 7px 0 0;
    color: #ffe0a5;
    font-size: 10px;
    line-height: 1.4;
  }

  &__status--warning,
  &__status--stale {
    color: #ffd08a !important;
  }
  &__status--error {
    color: #ffadc8 !important;
  }
  &__status--loading {
    color: #aeeeff !important;
  }

  &--warning,
  &--stale {
    border-color: rgba(255, 190, 90, 0.24);
  }
  &--error {
    border-color: rgba(255, 105, 138, 0.3);
  }

  @include down($bp-md) {
    ul {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

.station-hero {
  position: relative;
  isolation: isolate;
  padding: 10px;
  overflow: hidden;
  border-color: rgba(83, 216, 255, 0.28);
  background:
    radial-gradient(
      circle at 4% 0%,
      rgba(75, 209, 255, 0.18),
      transparent 34%
    ),
    radial-gradient(
      circle at 96% 100%,
      rgba(74, 239, 200, 0.12),
      transparent 38%
    ),
    linear-gradient(145deg, rgba(11, 39, 60, 0.78), rgba(6, 20, 36, 0.58));
  box-shadow:
    0 16px 34px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 0 1px rgba(68, 214, 255, 0.04);

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.24;
    background-image:
      linear-gradient(rgba(124, 220, 255, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124, 220, 255, 0.08) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.95),
      transparent 66%
    );
  }

  > * {
    position: relative;
    z-index: 2;
  }

  &__scanline {
    position: absolute;
    z-index: 1;
    top: -35%;
    bottom: -35%;
    left: -32%;
    width: 24%;
    pointer-events: none;
    opacity: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(133, 239, 255, 0.28),
      rgba(108, 255, 222, 0.1),
      transparent
    );
    filter: blur(2px);
    transform: skewX(-18deg);
    animation: nurse-station-hero-scan 7.2s ease-in-out infinite;
  }

  &__grid {
    position: absolute;
    z-index: 1;
    right: 14px;
    bottom: 13px;
    width: 76px;
    height: 38px;
    pointer-events: none;
    opacity: 0.38;
    border-top: 1px solid rgba(105, 235, 255, 0.34);
    border-right: 1px solid rgba(105, 235, 255, 0.2);
    background:
      linear-gradient(90deg, transparent 49%, rgba(105, 235, 255, 0.28) 50%, transparent 51%),
      linear-gradient(0deg, transparent 49%, rgba(105, 235, 255, 0.24) 50%, transparent 51%);
    background-size: 12px 12px;
    mask-image: linear-gradient(135deg, transparent, #000 46%);
  }

  &::before {
    content: "";
    position: absolute;
    left: -20%;
    right: -20%;
    top: -1px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(77, 208, 255, 0.55),
      transparent
    );
    opacity: 0.8;
  }

  &__top {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(96, 210, 255, 0.12);
  }

  &__eyebrow {
    display: inline-flex;
    margin-bottom: 5px;
    padding: 3px 8px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      rgba(77, 208, 255, 0.2),
      rgba(93, 242, 211, 0.13)
    );
    color: rgba(188, 239, 255, 0.92);
    border: 1px solid rgba(112, 230, 255, 0.2);
    box-shadow: 0 0 18px rgba(77, 208, 255, 0.08);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.6px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__title {
    h1,
    p {
      margin: 0;
    }

    h1 {
      color: #f2fbff;
      font-size: 21px;
      font-weight: 900;
      line-height: 1.2;
      text-shadow: 0 0 22px rgba(107, 224, 255, 0.18);
    }

    p {
      margin-top: 4px;
      color: rgba(182, 214, 235, 0.74);
      font-size: 12px;
    }
  }

  &__clock {
    flex-shrink: 0;
    text-align: right;

    time {
      display: block;
      color: #66e5ff;
      font-size: 24px;
      font-weight: 900;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 14px rgba(77, 208, 255, 0.35);
    }

    span,
    button {
      display: block;
      margin-top: 5px;
      color: rgba(170, 200, 225, 0.7);
      font-size: 10px;
    }
  }

  &__body {
    position: relative;
    display: grid;
    grid-template-columns: 84px 1fr;
    align-items: center;
    gap: 14px;
    padding-top: 9px;
  }

  &__status {
    min-width: 0;

    &-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    &-live {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
      color: rgba(150, 226, 232, 0.68);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.08em;
      white-space: nowrap;

      i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #69e4ca;
        box-shadow: 0 0 10px rgba(105, 228, 202, 0.78);
        animation: nurse-station-status-pulse 2.2s ease-in-out infinite;
      }
    }

    p {
      margin: 8px 0 0;
      color: rgba(220, 238, 250, 0.9);
      font-size: 13px;
      font-weight: 700;
      line-height: 1.45;
      text-shadow: 0 0 16px rgba(116, 207, 255, 0.12);
    }
  }

  &__badge {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: inline-flex;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    color: #d9fff1;
    background: rgba(84, 185, 116, 0.18);
    border: 1px solid rgba(103, 215, 140, 0.25);
    box-shadow: 0 0 14px rgba(103, 215, 140, 0.1);

    &::after {
      content: "";
      position: absolute;
      inset: -20% auto -20% -55%;
      width: 36%;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.42),
        transparent
      );
      transform: skewX(-18deg);
      animation: nurse-station-badge-sheen 4.8s ease-in-out infinite;
    }

    &--warn {
      color: #ffe2a7;
      background: rgba(255, 176, 56, 0.14);
      border-color: rgba(255, 190, 90, 0.28);
    }

    &--alert {
      color: #ffc4d6;
      background: rgba(232, 84, 128, 0.15);
      border-color: rgba(255, 137, 172, 0.28);
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;

    > span {
      position: relative;
      overflow: hidden;
      padding: 4px 8px;
      border-radius: 999px;
      background: linear-gradient(
        135deg,
        rgba(130, 206, 232, 0.11),
        rgba(255, 255, 255, 0.045)
      );
      border: 1px solid rgba(142, 220, 240, 0.14);
      color: rgba(195, 220, 240, 0.82);
      font-size: 11px;
      font-weight: 700;
      transition:
        transform 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease;

      &::after {
        content: "";
        position: absolute;
        inset: -30% auto -30% -45%;
        width: 28%;
        pointer-events: none;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(154, 240, 255, 0.3),
          transparent
        );
        transform: skewX(-18deg);
        animation: nurse-station-chip-sheen 5.8s ease-in-out infinite;
      }

      &:hover {
        transform: translateY(-1px);
        border-color: rgba(117, 231, 255, 0.34);
        background: rgba(77, 208, 255, 0.12);
      }
    }

    button {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
      padding: 4px 9px;
      border: 1px solid rgba(255, 185, 105, 0.28);
      border-radius: 999px;
      background: linear-gradient(
        135deg,
        rgba(255, 174, 79, 0.2),
        rgba(113, 52, 27, 0.22)
      );
      color: #ffe4b0;
      font: inherit;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      cursor: pointer;
      box-shadow: 0 0 14px rgba(255, 174, 79, 0.08);
      transition:
        transform 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 205, 126, 0.56);
        background: rgba(255, 174, 79, 0.26);
        box-shadow: 0 0 18px rgba(255, 174, 79, 0.16);
      }

      &:focus-visible {
        outline: 2px solid rgba(255, 216, 145, 0.86);
        outline-offset: 2px;
      }

      &[aria-pressed="true"] {
        border-color: rgba(103, 231, 180, 0.42);
        background: linear-gradient(
          135deg,
          rgba(70, 194, 147, 0.22),
          rgba(15, 79, 65, 0.26)
        );
        color: #c6ffe7;
        box-shadow: 0 0 16px rgba(70, 194, 147, 0.14);
      }

      .station-hero__alert-icon {
        width: 6px;
        height: 6px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: #ffc067;
        box-shadow: 0 0 10px rgba(255, 192, 103, 0.76);
      }

      &[aria-pressed="true"] .station-hero__alert-icon {
        background: #6be4b5;
        box-shadow: 0 0 10px rgba(107, 228, 181, 0.82);
      }
    }
  }
}

.station-state {
  position: relative;
  isolation: isolate;
  width: 84px;
  min-height: 72px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(103, 215, 140, 0.24);
  border-radius: 7px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 14%, rgba(103, 215, 140, 0.18), transparent 46%),
    linear-gradient(145deg, rgba(45, 121, 83, 0.2), rgba(15, 52, 54, 0.18));
  box-shadow:
    inset 0 1px 0 rgba(216, 255, 233, 0.08),
    0 0 18px rgba(103, 215, 140, 0.07);

  &::before {
    content: "";
    position: absolute;
    inset: 5px;
    z-index: -1;
    border: 1px solid rgba(125, 235, 164, 0.22);
    border-radius: 5px;
    opacity: 0.52;
    animation: nurse-station-status-pulse 3.2s ease-in-out infinite;
  }

  &::after {
    content: "";
    position: absolute;
    top: -36px;
    right: -36px;
    width: 86px;
    height: 86px;
    border: 1px solid rgba(120, 239, 181, 0.16);
    border-radius: 50%;
    box-shadow: 0 0 0 10px rgba(120, 239, 181, 0.035);
    pointer-events: none;
  }

  &__signal {
    position: relative;
    z-index: 1;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #67d78c;
    box-shadow: 0 0 12px rgba(103, 215, 140, 0.58);

    &::before {
      content: "";
      position: absolute;
      inset: -5px;
      border: 1px solid currentColor;
      border-radius: 50%;
      color: rgba(103, 215, 140, 0.5);
      animation: nurse-station-status-pulse 2.4s ease-out infinite;
    }
  }

  strong {
    position: relative;
    z-index: 1;
    color: #eaf7f1;
    font-size: 11px;
    line-height: 1.35;
  }

  small {
    position: relative;
    z-index: 1;
    color: rgba(180, 241, 203, 0.64);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.08em;
    line-height: 1.2;
  }

  &--warn {
    border-color: rgba(240, 189, 104, 0.28);
    background:
      radial-gradient(circle at 18% 14%, rgba(240, 189, 104, 0.18), transparent 46%),
      linear-gradient(145deg, rgba(128, 88, 29, 0.2), rgba(54, 46, 28, 0.2));

    &::before {
      border-color: rgba(255, 215, 143, 0.24);
    }

    .station-state__signal {
      background: #f0bd68;
      box-shadow: 0 0 12px rgba(240, 189, 104, 0.55);

      &::before {
        color: rgba(240, 189, 104, 0.52);
      }
    }

    small {
      color: rgba(255, 222, 163, 0.7);
    }
  }

  &--alert {
    border-color: rgba(238, 112, 133, 0.32);
    background:
      radial-gradient(circle at 18% 14%, rgba(238, 112, 133, 0.18), transparent 46%),
      linear-gradient(145deg, rgba(139, 47, 65, 0.2), rgba(56, 26, 42, 0.2));

    &::before {
      border-color: rgba(255, 156, 180, 0.26);
    }

    .station-state__signal {
      background: #ee7085;
      box-shadow: 0 0 12px rgba(238, 112, 133, 0.6);

      &::before {
        color: rgba(238, 112, 133, 0.58);
      }
    }

    small {
      color: rgba(255, 180, 199, 0.72);
    }
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  flex-shrink: 0;
}

.kpi-card {
  min-height: 56px;
  padding: 8px 10px 7px;
  border: 1px solid rgba(96, 210, 255, 0.13);
  border-radius: 8px;
  background: linear-gradient(
    180deg,
    rgba(15, 46, 70, 0.46),
    rgba(9, 26, 45, 0.42)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

  &__label {
    display: block;
    color: rgba(174, 205, 230, 0.74);
    font-size: 11px;
    font-weight: 700;
  }

  strong {
    display: block;
    margin-top: 7px;
    color: #f2fbff;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;

    small {
      margin-left: 3px;
      color: rgba(184, 215, 235, 0.72);
      font-size: 11px;
      font-weight: 700;
    }
  }

  &--green strong {
    color: #bdf7c8;
  }
  &--infusion strong {
    color: #aeeeff;
  }
  &--warn strong {
    color: #ffd08a;
  }
  &--alert strong {
    color: #ffadc8;
  }
}

.surface-panel {
  padding: 9px 10px;
  overflow: hidden;

  :deep(.dash-head) {
    margin-bottom: 8px;
  }

  &--focus {
    flex-shrink: 0;
  }

  &--env,
  &--feed {
    background: linear-gradient(
      180deg,
      rgba(10, 30, 48, 0.46),
      rgba(7, 21, 34, 0.38)
    );
  }
}

.ops-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ops-row {
  &__head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: rgba(196, 224, 242, 0.86);
    font-size: 12px;
    font-weight: 800;

    strong {
      color: #eafaff;
      font-variant-numeric: tabular-nums;
    }
  }

  &__track {
    height: 6px;
    margin-top: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #43d7ff;
      transition: width 0.35s ease;
    }
  }

  p {
    margin: 4px 0 0;
    color: rgba(152, 184, 210, 0.72);
    font-size: 10px;
  }

  &--green .ops-row__track i {
    background: #67d78c;
  }
  &--blue .ops-row__track i {
    background: #6ba9ff;
  }
  &--warn .ops-row__track i {
    background: #ffb84a;
  }
  &--alert .ops-row__track i {
    background: #ff719d;
  }
}

.focus-list,
.feed {
  list-style: none;
  margin: 0;
  padding: 0;
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 152px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.focus-room {
  width: 100%;
  color: inherit;
  font-family: inherit;
  text-align: left;
  display: grid;
  grid-template-columns: 4px 1fr auto;
  gap: 9px;
  align-items: center;
  min-height: 44px;
  padding: 7px 9px 7px 0;
  border: 1px solid rgba(96, 210, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  cursor: pointer;
  transition:
    background 0.14s,
    border-color 0.14s;

  &:hover {
    background: rgba(77, 208, 255, 0.08);
    border-color: rgba(96, 210, 255, 0.22);
  }

  &:focus-visible {
    outline: 2px solid rgba(129, 216, 209, 0.88);
    outline-offset: 2px;
  }

  &__bar {
    align-self: stretch;
    border-radius: 999px;
  }

  &__main {
    min-width: 0;

    strong,
    span {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    strong {
      color: #edf9ff;
      font-size: 12px;
      font-weight: 800;
    }

    span {
      margin-top: 3px;
      color: rgba(168, 200, 225, 0.72);
      font-size: 10px;
    }
  }

  &__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;

    em {
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.09);
      color: rgba(225, 242, 255, 0.88);
      font-size: 10px;
      font-style: normal;
      font-weight: 800;
    }

    span {
      color: rgba(164, 196, 220, 0.76);
      font-size: 10px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
  }

  &--calling,
  &--danger {
    background: rgba(232, 84, 128, 0.09);
    border-color: rgba(255, 137, 172, 0.2);
  }
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.env-card {
  min-width: 0;
  padding: 8px 8px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);

  span {
    display: block;
    color: rgba(170, 202, 226, 0.72);
    font-size: 10px;
    font-weight: 700;
  }

  strong {
    display: block;
    margin-top: 6px;
    color: #eafaff;
    font-size: 18px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;

    small {
      margin-left: 2px;
      color: rgba(170, 202, 226, 0.68);
      font-size: 10px;
    }
  }
}

.device-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 11px;

  span {
    color: rgba(170, 202, 226, 0.72);
    min-width: 0;
  }

  strong {
    color: #dff8ff;
    font-weight: 900;
  }

  em {
    grid-column: 1 / -1;
    color: #9fe8b0;
    font-style: normal;
    font-weight: 800;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__item {
    display: grid;
    grid-template-columns: 42px 32px 1fr;
    gap: 6px;
    align-items: start;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 10px;
  }

  &__time {
    color: rgba(150, 180, 205, 0.74);
    font-variant-numeric: tabular-nums;
  }

  &__tag {
    color: rgba(179, 210, 232, 0.72);
    font-weight: 700;
  }

  &__text {
    color: rgba(220, 238, 250, 0.86);
    line-height: 1.35;
  }

  &__item--call &__text {
    color: #ffadc8;
  }
  &__item--infusion &__text {
    color: #aeeeff;
  }
  &__item--env &__text {
    color: #ffd08a;
  }
}

.empty-feed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 11px;
  border-radius: 7px;
  background: rgba(103, 215, 140, 0.08);
  border: 1px solid rgba(103, 215, 140, 0.16);

  strong {
    color: #e8ffed;
    font-size: 12px;
  }

  span {
    color: rgba(190, 225, 205, 0.72);
    font-size: 10px;
    line-height: 1.4;
  }
}

@include down($bp-lg) {
  .station-hero {
    &__body {
      grid-template-columns: 76px 1fr;
    }
  }

  .station-state {
    width: 76px;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.inspection-overview {
  padding: 11px;
  border: 1px solid rgba(91, 210, 255, 0.2);
  border-radius: 11px;
  background:
    radial-gradient(circle at 86% 14%, rgba(74, 222, 196, 0.09), transparent 34%),
    linear-gradient(135deg, rgba(10, 42, 61, 0.72), rgba(5, 19, 34, 0.66));
  box-shadow: inset 3px 0 0 rgba(81, 224, 197, 0.5);

  &__head,
  &__head > div,
  &__metrics,
  &__rooms button {
    display: flex;
  }

  &__head {
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    > div {
      align-items: baseline;
      gap: 7px;
    }

    span {
      color: #dffaff;
      font-size: 13px;
      font-weight: 800;
    }

    strong,
    small {
      color: rgba(171, 216, 232, 0.72);
      font-size: 10px;
    }
  }

  &__metrics {
    gap: 7px;
    margin-top: 9px;
  }

  &__rooms {
    display: grid;
    gap: 5px;
    padding: 0;
    margin: 8px 0 0;
    list-style: none;

    button {
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 7px;
      color: #eefcff;
      background: rgba(3, 16, 28, 0.42);
      font-family: inherit;
      cursor: pointer;
    }

    button > span {
      display: grid;
      gap: 2px;
      text-align: left;
    }

    strong {
      font-size: 11px;
    }

    small {
      color: rgba(192, 218, 232, 0.72);
      font-size: 9px;
    }

    em {
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 9px;
      font-style: normal;
      font-weight: 800;

      &.is-overdue {
        color: #ffd8ca;
        background: rgba(210, 67, 44, 0.26);
      }

      &.is-due {
        color: #ffe0a7;
        background: rgba(179, 112, 24, 0.24);
      }
    }
  }

  > p {
    margin: 8px 0 0;
    color: rgba(190, 220, 232, 0.74);
    font-size: 10px;
  }
}

.inspection-metric {
  display: grid;
  grid-template-columns: 1fr auto;
  flex: 1;
  gap: 1px 5px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 7px;
  background: rgba(3, 17, 30, 0.38);

  span,
  small {
    color: rgba(191, 219, 231, 0.72);
    font-size: 9px;
  }

  strong {
    grid-row: span 2;
    color: #7ff6da;
    font-size: 19px;
  }

  &--due strong {
    color: #ffc768;
  }

  &--overdue strong {
    color: #ff766c;
  }
}

@media (min-width: 1024px) and (max-width: 1199px) {
  .nurse-panel {
    gap: 7px;
    padding: 8px 10px 10px;
  }

  .station-hero {
    padding: 8px;

    &__top {
      gap: 8px;
    }

    &__title h1 {
      font-size: 18px;
    }

    &__clock time {
      font-size: 19px;
    }

    &__body {
      grid-template-columns: 68px minmax(0, 1fr);
      gap: 9px;
    }
  }

  .station-state {
    width: 68px;
    min-height: 64px;
    padding: 8px;
  }

  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .kpi-card {
    min-height: 52px;
    padding: 7px 8px;

    strong {
      font-size: 19px;
    }
  }

  .data-health ul {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-height: 720px) and (min-width: 1024px) {
  .nurse-panel {
    gap: 5px;
    padding-block: 6px 8px;
  }

  .station-hero {
    padding-block: 6px;

    &__top {
      padding-bottom: 6px;
    }

    &__body {
      padding-top: 6px;
    }
  }

  .handoff-card,
  .data-health {
    padding-block: 7px;
  }

  .surface-panel {
    padding-block: 7px;
  }
}
</style>
