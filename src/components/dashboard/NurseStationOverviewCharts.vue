<script setup lang="ts">
import { computed, useId } from 'vue';
import type { NurseStationViewModel } from '@/core/nurse-station-view-model';
import { bedUsageRatio, pendingEventDistribution, usageGaugePoint } from '@/core/nurse-overview-charts';

const props = defineProps<{ viewModel: NurseStationViewModel; wallboard?: boolean }>();
const emit = defineEmits<{ openTasks: [] }>();
const chartId = useId();
const ratio = computed(() => bedUsageRatio(props.viewModel.metrics.occupied, props.viewModel.metrics.totalBeds));
const percent = computed(() => ratio.value == null ? '—' : String(Math.round(ratio.value * 100)));
const distribution = computed(() => pendingEventDistribution(props.viewModel.alertTasks));
const marker = computed(() => usageGaugePoint(ratio.value ?? 0));
const start = usageGaugePoint(0);
const end = usageGaugePoint(1);
const arc = `M ${start.x} ${start.y} A 78 78 0 1 1 ${end.x} ${end.y}`;
const ticks = Array.from({ length: 61 }, (_, index) => ({
  start: usageGaugePoint(index / 60, 87),
  end: usageGaugePoint(index / 60, index % 5 === 0 ? 92 : 89),
  major: index % 5 === 0,
}));
const wardSource = computed(() => props.viewModel.dataFreshnessItems.find(item => item.key === 'ward'));
const bedNoticeTone = computed(() => wardSource.value?.status !== 'ready' || (ratio.value == null && props.viewModel.metrics.totalBeds !== 0) ? 'warning' : 'neutral');
const bedNotice = computed(() => {
  if (wardSource.value?.status !== 'ready') return '病区数据未完全同步，当前数值请复核';
  if (ratio.value == null) return props.viewModel.metrics.totalBeds === 0 ? '暂无床位数据，暂不计算使用率' : '床位数量异常，暂不计算使用率';
  return '';
});
const eventNotice = computed(() => {
  if (!props.viewModel.dataHealth.canDeclareNormal) return '数据未完全同步，仅统计当前已获取的待处理事项';
  return distribution.value.total === 0 ? '当前暂无待处理事件' : '';
});
</script>

<template>
  <section class="station-charts" aria-label="病区概览图表">
    <header class="station-charts__heading">
      <h2><small>02 /</small> 病区概览</h2>
      <span class="station-charts__sync" :data-status="viewModel.realtime.status" :title="viewModel.realtime.detail">{{ viewModel.realtime.label }}</span>
    </header>

    <section class="station-chart station-chart--beds" :aria-labelledby="`${chartId}-beds`">
      <header class="station-chart__heading">
        <h3 :id="`${chartId}-beds`"><svg class="station-chart__title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2" /></svg>床位使用情况</h3><span aria-hidden="true">BED OCCUPANCY</span>
      </header>
      <div class="station-chart__bed-layout">
        <div class="usage-gauge" :role="ratio == null ? 'img' : 'meter'" :aria-label="ratio == null ? '床位使用率暂无数据' : '床位使用率'"
          :aria-valuenow="ratio == null ? undefined : Number(percent)" :aria-valuemin="ratio == null ? undefined : 0" :aria-valuemax="ratio == null ? undefined : 100">
          <svg viewBox="0 10 220 150" aria-hidden="true">
            <defs><linearGradient :id="`${chartId}-arc`" x1="0" y1="0" x2="1" y2="0"><stop class="usage-gauge__gradient-start"/><stop offset="1" class="usage-gauge__gradient-end"/></linearGradient></defs>
            <path class="usage-gauge__track" :d="arc" />
            <path v-if="ratio != null && ratio > 0" class="usage-gauge__fill" :d="arc" pathLength="100" :stroke="`url(#${chartId}-arc)`" :stroke-dasharray="`${ratio * 100} 100`" />
            <g class="usage-gauge__ticks"><line v-for="(tick, index) in ticks" :key="index" :x1="tick.start.x" :y1="tick.start.y" :x2="tick.end.x" :y2="tick.end.y" :stroke-width="tick.major ? 1.5 : 0.7" /></g>
            <path class="usage-gauge__inner" d="M 51 142 A 68 68 0 1 1 169 142" />
            <rect v-if="ratio != null" class="usage-gauge__marker" :x="marker.x - 4" :y="marker.y - 4" width="8" height="8" :transform="`rotate(45 ${marker.x} ${marker.y})`" />
            <text class="usage-gauge__number" x="110" y="112">{{ percent }}<tspan v-if="ratio != null" class="usage-gauge__unit">%</tspan></text>
            <text class="usage-gauge__label" x="110" y="134">床位使用率</text>
          </svg>
          <p>在用 <b>{{ viewModel.metrics.occupied }}</b> / 总床位 <b>{{ viewModel.metrics.totalBeds }}</b></p>
        </div>
        <dl class="station-chart__bed-stats">
          <div data-kind="occupied"><dt><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2"/></svg>在用</dt><dd>{{ viewModel.metrics.occupied }} <small>床</small></dd></div>
          <div data-kind="empty"><dt><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2"/></svg>空床</dt><dd>{{ viewModel.metrics.empty }} <small>床</small></dd></div>
        </dl>
      </div>
      <p v-if="bedNotice" class="station-chart__notice" :data-tone="bedNoticeTone">{{ bedNotice }}</p>
    </section>

    <section class="station-chart station-chart--events" :aria-labelledby="`${chartId}-events`">
      <header class="station-chart__heading"><h3 :id="`${chartId}-events`"><svg class="station-chart__title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v18h17M8 16v-5m5 5V6m5 10V9" /></svg>待处理事件分布</h3><span aria-hidden="true">PENDING EVENTS</span></header>
      <ol class="event-meters">
        <li v-for="(row, index) in distribution.rows" :key="row.key" class="event-meter" :data-kind="row.key" :data-empty="row.count === 0">
          <span class="event-meter__label"><small aria-hidden="true">0{{ index + 1 }}</small>{{ row.label }}</span>
          <div class="event-meter__track" aria-hidden="true">
            <i v-for="guide in 5" :key="guide" class="event-meter__guide" :style="{ left: `${(guide - 1) * 25}%` }" />
            <span class="event-meter__line" :style="{ width: `${row.ratio * 100}%` }" />
            <i v-if="row.count > 0" class="event-meter__marker" :style="{ left: `${row.ratio * 100}%` }" />
          </div>
          <strong class="event-meter__count">{{ row.count }}<span class="station-charts__sr-only">项</span></strong>
        </li>
      </ol>
      <footer class="station-chart__total">待处理合计 <strong>{{ distribution.total }}</strong> 项</footer>
      <p class="station-chart__caption">仅含待处理事项 · 条长按当前类别最大值比较</p>
      <p v-if="eventNotice" class="station-chart__notice" :data-tone="viewModel.dataHealth.canDeclareNormal ? 'neutral' : 'warning'">{{ eventNotice }}</p>
    </section>
    <button v-if="!wallboard" class="station-charts__open" @click="emit('openTasks')">查看事件队列 <span aria-hidden="true">→</span></button>
  </section>
</template>

<style scoped lang="scss" src="./nurse-station-overview-charts.scss"></style>
