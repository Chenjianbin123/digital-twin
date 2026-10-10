<script setup lang="ts">
import { computed } from 'vue';
import { resolveBedStatus } from '@/core/bed-status';
import type { TwinAreaEntity } from '@/types/twin';

const props = defineProps<{
  area: TwinAreaEntity | null;
  theme?: 'light' | 'dark';
}>();

const statCards = computed(() => {
  if (!props.area)
    return [];

  let calling = 0;
  let offline = 0;

  for (const room of props.area.rooms) {
    for (const bed of room.beds) {
      if (bed.isCalling)
        calling++;
      const status = resolveBedStatus(bed);
      if (status.state === 'offline' || status.state === 'lowBattery')
        offline++;
    }
  }

  const cards = [
    { key: 'calling', label: '呼叫中', value: calling, icon: 'alert' },
    { key: 'offline', label: '离线设备', value: offline, icon: 'offline' },
  ];

  return cards.filter(card => card.value > 0);
});
</script>

<template>
  <aside v-if="statCards.length" class="dash-left" :data-theme="theme ?? 'dark'" aria-label="病区告警概览">
    <ul class="dash-left__stats">
      <li v-for="card in statCards" :key="card.key" class="stat-card" :class="`stat-card--${card.key}`" :title="card.key === 'offline' ? '离线或低电量的床头设备' : '当前正在呼叫的床位'">
        <span class="stat-card__icon" :class="`stat-card__icon--${card.icon}`" aria-hidden="true" />
        <div class="stat-card__body">
          <span class="stat-card__label">{{ card.label }}</span>
          <span class="stat-card__value">{{ card.value }}<small>{{ card.key === 'calling' ? '床' : '台' }}</small></span>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped lang="scss">
.dash-left {
  --alert-surface: #102c3e;
  --alert-ink: #edf8ff;
  --alert-muted: #b3cbd9;
  --alert-line: #356579;
  --alert-accent: #74d4ea;
  --alert-calling: #ff9eb0;
  --alert-offline: #f1c477;
  --alert-inset: #18394c;
  --alert-shadow: rgba(0, 14, 24, .22);
  width: 100%;
  min-width: 0;
  font-family: var(--sidebar-font-family, 'Microsoft YaHei', sans-serif);
  pointer-events: none;

  &[data-theme='light'] {
    --alert-surface: #f3f9fc;
    --alert-ink: #203e50;
    --alert-muted: #526e80;
    --alert-line: #b1ccda;
    --alert-accent: #287e9c;
    --alert-calling: #b83553;
    --alert-offline: #936016;
    --alert-inset: #e7f1f7;
    --alert-shadow: rgba(31, 75, 98, .09);
  }

  &__stats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 8px;
  }

  @include down($bp-sm) {
    display: none;
  }
}

.stat-card {
  --status-color: var(--alert-calling);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  color: var(--alert-ink);
  background: var(--alert-surface);
  border: 1px solid var(--alert-line);
  border-left: 3px solid var(--status-color);
  border-radius: 4px 10px 4px 10px;
  box-shadow: 0 5px 14px var(--alert-shadow);

  &--offline { --status-color: var(--alert-offline); }

  &::before, &::after {
    content: ''; position: absolute; pointer-events: none;
  }
  &::before {
    top: 5px; right: 5px; width: 9px; height: 9px;
    border-top: 1px solid var(--alert-accent);
    border-right: 1px solid var(--alert-accent);
  }
  &::after {
    bottom: 0; left: 12px; right: 12px; height: 1px;
    background: linear-gradient(90deg, var(--alert-accent), transparent);
    opacity: .5;
  }

  &__icon {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--alert-line);
    background: var(--alert-inset);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 8px;
      border-radius: 2px;
      background: var(--status-color);
    }

    &--alert::after {
      clip-path: polygon(50% 15%, 15% 85%, 85% 85%);
      inset: 7px;
      border-radius: 0;
    }

    &--offline::after {
      border-radius: 50%;
      width: 8px;
      height: 8px;
      top: 12px;
      left: 12px;
    }
  }

  &__body {
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: var(--sidebar-font-label, 14px);
    font-weight: 600;
    line-height: 1.5;
    color: var(--alert-muted);
    margin-bottom: 4px;
  }

  &__value {
    display: block;
    font-size: var(--sidebar-font-metric, 26px);
    font-weight: 800;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    color: var(--status-color);
    overflow-wrap: anywhere;
    small {
      margin-left: 5px;
      font-size: var(--sidebar-font-label, 14px);
      font-weight: 500;
      color: var(--alert-muted);
    }
  }
}
</style>
