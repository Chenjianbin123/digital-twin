<script setup lang="ts">
import { computed } from 'vue';
import { resolveBedStatus } from '@/core/bed-status';
import type { TwinAreaEntity } from '@/types/twin';

const props = defineProps<{
  area: TwinAreaEntity | null;
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
  <aside v-if="statCards.length" class="dash-left" aria-label="左侧告警概览">
    <ul class="dash-left__stats">
      <li v-for="card in statCards" :key="card.key" class="stat-card">
        <span class="stat-card__icon" :class="`stat-card__icon--${card.icon}`" aria-hidden="true" />
        <div class="stat-card__body">
          <span class="stat-card__label">{{ card.label }}</span>
          <span class="stat-card__value">{{ card.value }}</span>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped lang="scss">
.dash-left {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 15;
  width: 200px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  &__stats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @include down($bp-md) {
    top: 56px;
    left: 8px;
    width: 160px;
  }

  @include down($bp-sm) {
    display: none;
  }
}

.stat-card {
  @include dash-glass-panel;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;

  &__icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(77, 208, 255, 0.35);
    background: radial-gradient(circle at 35% 30%, rgba(77, 208, 255, 0.25), rgba(0, 50, 90, 0.2));
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 8px;
      border-radius: 2px;
      background: #4deaff;
      opacity: 0.85;
    }

    &--alert::after {
      clip-path: polygon(50% 15%, 15% 85%, 85% 85%);
      inset: 7px;
      border-radius: 0;
      background: #f48fb1;
    }

    &--offline::after {
      border-radius: 50%;
      width: 8px;
      height: 8px;
      top: 7px;
      left: 11px;
      background: #ef9a9a;
    }

    &--patient::after {
      border-radius: 50%;
      width: 8px;
      height: 8px;
      top: 6px;
      left: 11px;
      box-shadow: 0 10px 0 -3px #4deaff;
    }
  }

  &__body {
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: 10px;
    color: rgba(180, 210, 235, 0.88);
    margin-bottom: 2px;
  }

  &__value {
    display: block;
    font-size: 22px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    @include dash-glow-text;
  }
}
</style>
