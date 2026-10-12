<script setup lang="ts">
import { computed, reactive, useId } from 'vue';
import SidebarSectionToggle from './SidebarSectionToggle.vue';
import type { RoomSummary } from '@/core/area-summary';
import type { DataStatus } from '@/core/data-status';
import { usageGaugePoint } from '@/core/nurse-overview-charts';
import { buildCorridorChartData } from '@/core/ward-corridor-charts';
import type { InspectionRoomSummary } from '@/types/inspection';

const props = defineProps<{
  rooms: RoomSummary[];
  inspections: InspectionRoomSummary[];
  wardDataStatus?: DataStatus;
  inspectionDataStatus?: DataStatus;
}>();
const chartId = useId();
const collapsed = reactive({ beds: false, rooms: false, inspection: false });
const chart = computed(() => buildCorridorChartData(props.rooms, props.inspections));
const percent = computed(() => chart.value.ratio === null ? '—' : Math.round(chart.value.ratio * 100));
const marker = computed(() => usageGaugePoint(chart.value.ratio ?? 0));
const start = usageGaugePoint(0), end = usageGaugePoint(1);
const arc = `M ${start.x} ${start.y} A 78 78 0 1 1 ${end.x} ${end.y}`;
const ticks = Array.from({ length: 61 }, (_, index) => ({
  start: usageGaugePoint(index / 60, 87),
  end: usageGaugePoint(index / 60, index % 5 === 0 ? 92 : 89),
  major: index % 5 === 0,
}));
const syncLabels: Record<DataStatus, string> = {
  loading: '同步中', ready: '已同步', warning: '部分同步', stale: '已过期', error: '同步失败',
};
const bedNotice = computed(() => {
  if (props.wardDataStatus !== 'ready')
    return `病区数据${syncLabels[props.wardDataStatus ?? 'loading']}，仅展示已获取数据，请复核`;
  if (chart.value.total === null) return '床位数量异常，暂不计算使用率';
  return chart.value.total === 0 ? '暂无床位数据，暂不计算使用率' : '';
});
const inspectionNotice = computed(() => props.inspectionDataStatus === 'ready'
  ? '按房间展示最近记录；暂无记录不等同于未巡视。'
  : `巡视记录${syncLabels[props.inspectionDataStatus ?? 'loading']}，仅统计已获取记录，不代表巡视完成率。`);
const missingLabel = computed(() => props.inspectionDataStatus === 'ready' ? '暂无记录' : '未获取记录');
const countsAvailable = computed(() => props.rooms.length > 0 || props.wardDataStatus === 'ready');
function displayCount(value: number | null) { return countsAvailable.value ? value ?? '—' : '—'; }
</script>

<template>
  <section class="station-charts corridor-charts" aria-label="病房走廊概览图表">
    <section class="station-chart" :class="{ 'sidebar-section--collapsed': collapsed.beds }" :aria-labelledby="`${chartId}-beds`">
      <header class="station-chart__heading">
        <h3 :id="`${chartId}-beds`"><svg class="station-chart__title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2" /></svg>床位使用情况</h3>
        <div class="sidebar-section-actions"><span class="sidebar-section-eyebrow" aria-hidden="true">BED OCCUPANCY</span><SidebarSectionToggle v-model="collapsed.beds" label="床位使用情况" :controls="`${chartId}-beds-content`" /></div>
      </header>
      <div :id="`${chartId}-beds-content`" v-show="!collapsed.beds" class="sidebar-section-body">
      <div class="station-chart__bed-layout">
        <div class="usage-gauge" :role="chart.ratio === null ? 'img' : 'meter'"
          :aria-label="chart.ratio === null ? '床位使用率暂无数据' : '床位使用率'"
          :aria-valuenow="chart.ratio === null ? undefined : Number(percent)"
          :aria-valuemin="chart.ratio === null ? undefined : 0" :aria-valuemax="chart.ratio === null ? undefined : 100">
          <svg viewBox="0 10 220 150" aria-hidden="true">
            <defs><linearGradient :id="`${chartId}-arc`" x1="0" y1="0" x2="1" y2="0"><stop class="usage-gauge__gradient-start"/><stop offset="1" class="usage-gauge__gradient-end"/></linearGradient></defs>
            <path class="usage-gauge__track" :d="arc"/>
            <path v-if="chart.ratio !== null && chart.ratio > 0" class="usage-gauge__fill" :d="arc" pathLength="100" :stroke="`url(#${chartId}-arc)`" :stroke-dasharray="`${chart.ratio * 100} 100`"/>
            <g class="usage-gauge__ticks"><line v-for="(tick, index) in ticks" :key="index" :x1="tick.start.x" :y1="tick.start.y" :x2="tick.end.x" :y2="tick.end.y" :stroke-width="tick.major ? 1.5 : 0.7"/></g>
            <path class="usage-gauge__inner" d="M 51 142 A 68 68 0 1 1 169 142"/>
            <rect v-if="chart.ratio !== null" class="usage-gauge__marker" :x="marker.x - 4" :y="marker.y - 4" width="8" height="8" :transform="`rotate(45 ${marker.x} ${marker.y})`"/>
            <text class="usage-gauge__number" x="110" y="112">{{ percent }}<tspan v-if="chart.ratio !== null" class="usage-gauge__unit">%</tspan></text>
            <text class="usage-gauge__label" x="110" y="134">床位使用率</text>
          </svg>
          <p>在用 <b>{{ displayCount(chart.occupied) }}</b> / 总床位 <b>{{ displayCount(chart.total) }}</b></p>
        </div>
        <dl class="station-chart__bed-stats">
          <div data-kind="occupied"><dt>在用</dt><dd>{{ displayCount(chart.occupied) }} <small>床</small></dd></div>
          <div data-kind="empty"><dt>空床</dt><dd>{{ displayCount(chart.empty) }} <small>床</small></dd></div>
        </dl>
      </div>
      <p v-if="bedNotice" class="station-chart__notice" :data-tone="wardDataStatus !== 'ready' || chart.total === null ? 'warning' : 'neutral'">{{ bedNotice }}</p>
      </div>
    </section>

    <section class="station-chart corridor-capacity-card" :class="{ 'sidebar-section--collapsed': collapsed.rooms }" :aria-labelledby="`${chartId}-rooms`">
      <header class="station-chart__heading"><h3 :id="`${chartId}-rooms`"><svg class="station-chart__title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v18h17M8 16v-5m5 5V6m5 10V9"/></svg>病房床位对比</h3><div class="sidebar-section-actions"><span class="sidebar-section-eyebrow" aria-hidden="true">ROOM CAPACITY</span><SidebarSectionToggle v-model="collapsed.rooms" label="病房床位对比" :controls="`${chartId}-rooms-content`" /></div></header>
      <div :id="`${chartId}-rooms-content`" v-show="!collapsed.rooms" class="sidebar-section-body">
      <div class="corridor-charts__legend"><span><i data-kind="occupied"/>在用</span><span><i data-kind="empty"/>空床</span><small>{{ chart.rows.length }} 间病房 · 单位：床</small></div>
      <p v-if="!chart.rows.length" class="station-chart__notice">{{ wardDataStatus === 'ready' ? '暂无病房数据' : '等待病区数据同步' }}</p>
      <ul v-else class="corridor-capacity" role="list" aria-label="各病房在用与空床数量">
        <li v-for="room in chart.rows" :key="room.code" class="corridor-capacity__row">
          <span class="corridor-capacity__name"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2"/></svg><span>{{ room.name }}</span></span>
          <div class="corridor-capacity__counts">
            <span data-kind="occupied"><b>{{ room.occupied ?? '—' }}</b> 在用</span>
            <span data-kind="empty"><b>{{ room.empty ?? '—' }}</b> 空床</span>
          </div>
          <div v-if="room.total !== null && room.total > 0" class="corridor-capacity__track" aria-hidden="true">
            <span v-if="room.occupied !== null && room.occupied > 0" class="corridor-capacity__used" :style="{ width: `${room.occupied / chart.maxBeds * 100}%` }"/>
            <span v-if="room.empty !== null && room.empty > 0" class="corridor-capacity__empty" :style="{ width: `${room.empty / chart.maxBeds * 100}%` }"/>
          </div>
          <p v-else class="corridor-capacity__no-data">{{ room.total === 0 ? '暂无床位数据' : '床位数据待核实' }}</p>
        </li>
      </ul>
      <div v-if="chart.rows.length" class="corridor-capacity__axis"><span aria-hidden="true">0</span><span>统一刻度 · 便于横向比较</span><span aria-hidden="true">{{ chart.maxBeds }} 床</span></div>
      </div>
    </section>

    <section class="station-chart" :class="{ 'sidebar-section--collapsed': collapsed.inspection }" :aria-labelledby="`${chartId}-inspection`">
      <header class="station-chart__heading"><h3 :id="`${chartId}-inspection`"><svg class="station-chart__title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H5v16h14V5h-3M9 3h6v4H9zM8 13l3 3 5-6"/></svg>巡视记录覆盖</h3><div class="sidebar-section-actions"><span class="sidebar-section-eyebrow" aria-hidden="true">ROUNDING RECORDS</span><SidebarSectionToggle v-model="collapsed.inspection" label="巡视记录覆盖" :controls="`${chartId}-inspection-content`" /></div></header>
      <div :id="`${chartId}-inspection-content`" v-show="!collapsed.inspection" class="sidebar-section-body">
      <div class="corridor-records__summary"><p><strong>{{ chart.rows.length || inspectionDataStatus === 'ready' ? chart.recorded : '—' }}</strong> / {{ chart.rows.length }} 间有记录</p><span>{{ missingLabel }} <b>{{ chart.missing }}</b> 间</span></div>
      <ul class="corridor-records" aria-label="各病房最近巡视记录">
        <li v-for="room in chart.rows" :key="room.code" :data-recorded="!!room.latestAt">
          <span class="corridor-records__node" aria-hidden="true"><svg viewBox="0 0 24 24"><path :d="room.latestAt ? 'M5 12l4 4L19 6' : 'M6 12h12'"/></svg></span>
          <strong>{{ room.name }}</strong><time v-if="room.latestAt" :datetime="room.latestAt">{{ room.timeLabel }}</time><span v-else>{{ missingLabel }}</span>
        </li>
      </ul>
      <p class="station-chart__notice" :data-tone="inspectionDataStatus === 'ready' ? 'neutral' : 'warning'">{{ inspectionNotice }}</p>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss" src="./ward-corridor-charts.scss"></style>
