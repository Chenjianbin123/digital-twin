<script setup lang="ts">
import { ref } from 'vue';
import { getStatusLegend } from '@/core/bed-status';

const legend = getStatusLegend();
const expanded = ref(false);

/** 仅异常态在图例中标注会动效高亮 */
const pulseStates = new Set(['calling', 'infusing', 'offline', 'lowBattery']);

function toggle() {
  expanded.value = !expanded.value;
}

function isPulseState(state: string) {
  return pulseStates.has(state);
}
</script>

<template>
  <div class="ward-legend" :class="{ 'ward-legend--open': expanded }">
    <button
      type="button"
      class="ward-legend__toggle"
      :title="expanded ? '收起图例' : '展开图例'"
      @click="toggle"
    >
      <svg class="ward-legend__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="3" fill="currentColor" opacity="0.7" />
        <circle cx="18" cy="6" r="3" fill="currentColor" opacity="0.9" />
        <circle cx="12" cy="18" r="3" fill="currentColor" />
      </svg>
      <span>图例</span>
    </button>

    <Transition name="legend-pop">
      <div v-if="expanded" class="ward-legend__panel">
        <p class="ward-legend__hint">日常在院为低对比；呼叫/输液等异常态才会高亮闪烁</p>
        <div class="ward-legend__grid">
          <span
            v-for="item in legend"
            :key="item.state"
            class="ward-legend__item"
            :class="{ 'ward-legend__item--pulse': isPulseState(item.state) }"
          >
            <i
              class="ward-legend__dot"
              :class="{ 'ward-legend__dot--pulse': isPulseState(item.state) }"
              :style="{ backgroundColor: item.color }"
            />
            {{ item.label }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.ward-legend {
  position: absolute;
  left: 220px;
  bottom: 88px;
  z-index: 10;
  pointer-events: none;

  &__toggle {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    background: rgba(10, 18, 28, 0.72);
    backdrop-filter: blur(8px);
    color: #8fa3b8;
    font-size: 12px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;

    &:hover {
      color: #c5d0db;
      border-color: rgba(76, 129, 98, 0.4);
      background: rgba(10, 18, 28, 0.88);
    }
  }

  &--open &__toggle {
    color: #81c784;
    border-color: rgba(76, 129, 98, 0.45);
  }

  &__icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  &__panel {
    pointer-events: auto;
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(10, 18, 28, 0.88);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  &__hint {
    margin: 0 0 8px;
    font-size: 10px;
    line-height: 1.4;
    color: #6b8299;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 16px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #a8b8c8;
    white-space: nowrap;

    &--pulse {
      color: #d0dae4;
    }
  }

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.85;

    &--pulse {
      opacity: 1;
      animation: legend-dot-soft 2.8s ease-in-out infinite;
    }
  }

  @include down($bp-sm) {
    left: 8px;
    bottom: 8px;

    &__toggle {
      padding: 5px 10px;
      font-size: 11px;
    }

    &__panel {
      max-width: calc(100vw - 32px);
    }

    &__grid {
      grid-template-columns: 1fr;
      gap: 6px;
    }
  }
}

.legend-pop-enter-active,
.legend-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.legend-pop-enter-from,
.legend-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes legend-dot-soft {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.12); opacity: 1; }
}
</style>
