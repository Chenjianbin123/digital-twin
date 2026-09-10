<script setup lang="ts">
import { computed } from "vue";
import type { NurseStationRealtimeStatus } from "@/core/nurse-station-view-model";

interface NurseStationKpi {
  key: string;
  label: string;
  value: number | string;
  unit: string;
  tone: string;
  percent?: number | null;
  detail?: string;
}

const props = defineProps<{
  kpis: NurseStationKpi[];
  realtimeStatus: NurseStationRealtimeStatus;
}>();

const hasData = computed(() => props.kpis.length > 0);

function clampedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value))
    return null;
  return Math.min(100, Math.max(0, value));
}
</script>

<template>
  <section class="nurse-metric-chart" aria-label="病区核心指标">
    <header class="nurse-metric-chart__head">
      <div>
        <span class="nurse-metric-chart__eyebrow">当前业务快照</span>
        <strong>病区核心指标</strong>
      </div>
      <span
        class="nurse-metric-chart__status"
        :class="`nurse-metric-chart__status--${realtimeStatus.status}`"
        :title="realtimeStatus.detail"
      >
        <i aria-hidden="true" />{{ realtimeStatus.label }}
      </span>
    </header>

    <div v-if="hasData" class="nurse-metric-chart__grid">
      <article
        v-for="item in kpis"
        :key="item.key"
        class="metric-item"
        :class="`metric-item--${item.tone}`"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
        <div
          v-if="clampedPercent(item.percent) != null"
          class="metric-item__progress"
          role="meter"
          :aria-label="`${item.label}${clampedPercent(item.percent)}%`"
          :aria-valuenow="clampedPercent(item.percent) ?? undefined"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <i :style="{ width: `${clampedPercent(item.percent)}%` }" />
        </div>
        <small v-if="item.detail" class="metric-item__detail">{{ item.detail }}</small>
      </article>
    </div>
    <div v-else class="nurse-metric-chart__empty">暂无可用指标</div>
  </section>
</template>

<style scoped lang="scss">
.nurse-metric-chart {
  min-height: 154px;
  padding: 12px 14px;
  border: 1px solid rgba(104, 229, 255, 0.2);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(13, 46, 65, 0.78), rgba(5, 20, 35, 0.7));

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__eyebrow,
  &__status {
    display: block;
    color: rgba(174, 220, 235, 0.72);
    font-size: 12px;
  }

  &__head strong {
    display: block;
    margin-top: 3px;
    color: #e8fbff;
    font-size: 14px;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #9df4bf;

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    &--loading,
    &--warning,
    &--stale { color: #ffd080; }
    &--error { color: #ff86b3; }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  &__empty {
    display: grid;
    min-height: 96px;
    place-items: center;
    color: rgba(190, 225, 238, 0.62);
    font-size: 12px;
  }
}

.metric-item {
  color: #8de7ff; min-width: 0;
  padding: 9px 10px;
  border: 1px solid rgba(104, 229, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);

  > span,
  &__detail {
    display: block;
    overflow: hidden;
    color: rgba(190, 225, 238, 0.72);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > strong {
    display: block;
    margin-top: 5px;
    color: #68e5ff;
    font-size: 20px;
    font-variant-numeric: tabular-nums;

    small {
      margin-left: 3px;
      color: rgba(220, 241, 247, 0.7);
      font-size: 12px;
    }
  }

  &__progress {
    height: 4px;
    margin-top: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: currentColor;
    }
  }

  &__detail { margin-top: 5px; }
  &--blue { color: #7aa8ff; }
  &--green { color: #9df4bf; }
  &--alert { color: #ff86b3; }
  &--infusion { color: #8de7ff; }
  &--warn { color: #ffd080; }
}

@media (max-width: 1199px) {
  .nurse-metric-chart__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.nurse-metric-chart {
  padding: 16px; background: #102936; border-color: #759bad38;
  &__head { flex-wrap: wrap; gap: 8px 16px; }
  &__head strong { font-size: 14px; font-weight: 600; margin-top: 5px; }
  &__status i { box-shadow: none; }
  &__grid { grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin-top: 16px; }
}
.metric-item {
  padding: 12px; background: #0a202d; border-color: #7eabb329; border-radius: 8px;
  > span { color: #adc5d1; }
  > strong { font-size: 26px; font-weight: 600; color: inherit; margin-top: 10px; overflow-wrap: anywhere; }
  &__detail { white-space: normal; line-height: 1.5; color: #9db8c7; }
  &__progress { margin-top: 10px; height: 3px; }
}
@container nurse-panel (max-width: 380px) {
  .nurse-metric-chart { padding: 12px; }
  .nurse-metric-chart__grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
</style>
