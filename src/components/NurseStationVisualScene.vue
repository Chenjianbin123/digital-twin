<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { RoomSummary } from '@/core/area-summary';
import type { AreaModelState } from '@/core/area-scene';
import type { TwinAreaEntity } from '@/types/twin';

const AreaScene3D = defineAsyncComponent(() => import('@/components/AreaScene3D.vue'));

defineProps<{
  area: TwinAreaEntity;
  roomSummaries: RoomSummary[];
  deviceCount?: number;
  overlaysVisible: boolean;
  modelState: AreaModelState;
}>();

const emit = defineEmits<{
  roomClick: [roomIndex: number];
  modelState: [state: AreaModelState];
}>();
</script>

<template>
  <section class="nurse-station-visual" aria-label="护士站空间态势">
    <div class="nurse-station-visual__scene">
      <AreaScene3D
        :area="area"
        :area-id="null"
        :room-summaries="roomSummaries"
        :configured-device-count="deviceCount"
        scene-type="nurse-station"
        @room-click="emit('roomClick', $event)"
        @model-state="emit('modelState', $event)"
      />
    </div>

    <div class="nurse-station-visual__wash" aria-hidden="true" />
    <div class="nurse-station-visual__ambient" aria-hidden="true" />
    <div class="nurse-station-visual__depth" aria-hidden="true" />

    <div
      v-if="overlaysVisible && modelState !== 'ready'"
      class="nurse-station-visual__model-state"
      :class="`nurse-station-visual__model-state--${modelState}`"
      role="status"
    >
      <span aria-hidden="true" />
      {{ modelState === 'loading' ? '护士站场景加载中' : '护士站模型加载失败' }}
    </div>
  </section>
</template>

<style scoped lang="scss">
.nurse-station-visual {
  position: absolute;
  inset: 0;
  overflow: hidden;
  isolation: isolate;
  background: #08141d;

  &__scene {
    position: absolute;
    inset: 0;
    animation: station-scene-enter 0.86s cubic-bezier(0.2, 0.72, 0.18, 1) both;

    :deep(.area-scene-3d__canvas-host) {
      pointer-events: auto;
    }
  }

  &__wash {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 50% 56%, rgba(180, 244, 255, 0.06) 0%, rgba(92, 205, 220, 0.02) 28%, transparent 54%),
      radial-gradient(ellipse at 50% 78%, rgba(0, 128, 148, 0.06) 0%, transparent 42%),
      linear-gradient(90deg, rgba(3, 11, 18, 0.12), transparent 18%, transparent 82%, rgba(3, 11, 18, 0.12)),
      linear-gradient(180deg, rgba(5, 18, 28, 0.02), transparent 22%, rgba(3, 12, 22, 0.07));
    mix-blend-mode: multiply;
  }

  &__ambient,
  &__depth {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  &__ambient {
    z-index: 4;
    background:
      radial-gradient(ellipse at 50% 42%, rgba(220, 250, 255, 0.1) 0%, rgba(149, 224, 232, 0.03) 38%, transparent 66%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 22%);
    mix-blend-mode: screen;
    opacity: 0.42;
  }

  &__depth {
    z-index: 5;
    background:
      linear-gradient(180deg, rgba(2, 10, 18, 0.04), transparent 26%, transparent 72%, rgba(1, 10, 16, 0.14)),
      radial-gradient(ellipse at 50% 82%, rgba(0, 120, 150, 0.08), transparent 54%);
  }

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }

  &::before {
    background:
      linear-gradient(180deg, rgba(2, 10, 18, 0.04), transparent 18%, transparent 74%, rgba(2, 9, 16, 0.08)),
      radial-gradient(ellipse at 50% 66%, transparent 0%, transparent 56%, rgba(1, 7, 14, 0.06) 88%);
  }

  &::after {
    inset: auto 11% 12.5% 11%;
    height: 16%;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 50%, rgba(77, 208, 255, 0.1), transparent 68%);
    filter: blur(14px);
    opacity: 0.28;
  }

  &__model-state {
    position: absolute;
    left: 28px;
    bottom: 58px;
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid rgba(116, 224, 255, 0.28);
    border-radius: 5px;
    background: rgba(8, 31, 43, 0.74);
    color: rgba(229, 249, 252, 0.9);
    font-size: 11px;
    font-weight: 700;
    backdrop-filter: blur(7px);

    span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #70dce8;
      box-shadow: 0 0 10px rgba(112, 220, 232, 0.7);
      animation: station-load-pulse 1.1s ease-in-out infinite;
    }

    &--fallback {
      border-color: rgba(238, 184, 92, 0.35);

      span {
        background: #f0bd68;
        animation: none;
      }
    }
  }
}

@keyframes station-load-pulse {
  50% { opacity: 0.35; }
}

@keyframes station-scene-enter {
  0% {
    opacity: 0;
    transform: scale(1.018) translateY(10px);
    filter: saturate(0.88) brightness(0.92);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: saturate(1) brightness(1);
  }
}

@media (max-width: 760px) {
  .nurse-station-visual__model-state {
    left: 12px;
    bottom: calc(42vh + 20px);
  }
}
</style>
