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
  active?: boolean;
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
        model-kind="station"
        :active="active !== false"
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
      aria-live="polite"
    >
      <div class="nurse-station-visual__model-state-grid" aria-hidden="true" />
      <div class="nurse-station-visual__model-state-glow" aria-hidden="true" />
      <div class="nurse-station-visual__model-state-card">
        <span class="nurse-station-visual__model-state-spinner" aria-hidden="true">
          <i />
        </span>
        <div class="nurse-station-visual__model-state-copy">
          <strong>
            {{ modelState === 'loading' ? '护士站场景加载中' : '护士站模型加载失败' }}
          </strong>
          <small>
            {{ modelState === 'loading' ? '正在解析 3D 模型，请稍候' : '请刷新页面重试' }}
          </small>
        </div>
        <span class="nurse-station-visual__model-state-status">
          {{ modelState === 'loading' ? 'LOADING' : 'OFFLINE' }}
        </span>
      </div>
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
      radial-gradient(ellipse at 50% 56%, rgba(180, 244, 255, 0.04) 0%, rgba(92, 205, 220, 0.01) 28%, transparent 54%),
      radial-gradient(ellipse at 50% 78%, rgba(0, 128, 148, 0.03) 0%, transparent 42%),
      linear-gradient(90deg, rgba(3, 11, 18, 0.05), transparent 18%, transparent 82%, rgba(3, 11, 18, 0.05)),
      linear-gradient(180deg, rgba(5, 18, 28, 0.01), transparent 22%, rgba(3, 12, 22, 0.03));
    mix-blend-mode: multiply;
    opacity: 0.55;
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
      radial-gradient(ellipse at 50% 42%, rgba(220, 250, 255, 0.06) 0%, rgba(149, 224, 232, 0.02) 38%, transparent 66%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 22%);
    mix-blend-mode: screen;
    opacity: 0.28;
  }

  &__depth {
    z-index: 5;
    background:
      linear-gradient(180deg, rgba(2, 10, 18, 0.05), transparent 24%, transparent 68%, rgba(1, 10, 16, 0.12)),
      radial-gradient(ellipse at 50% 82%, rgba(0, 90, 110, 0.07), transparent 54%);
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
      linear-gradient(180deg, rgba(2, 10, 18, 0.02), transparent 18%, transparent 74%, rgba(2, 9, 16, 0.04)),
      radial-gradient(ellipse at 50% 66%, transparent 0%, transparent 56%, rgba(1, 7, 14, 0.03) 88%);
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
    inset: 0;
    z-index: 8;
    display: grid;
    place-items: center;
    overflow: hidden;
    isolation: isolate;
    padding: 24px;
    background:
      linear-gradient(180deg, rgba(4, 16, 27, 0.42), rgba(3, 13, 23, 0.78)),
      rgba(3, 14, 24, 0.38);
    color: rgba(229, 249, 252, 0.94);
    pointer-events: none;
    backdrop-filter: blur(2px) saturate(120%);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -2;
      background:
        repeating-linear-gradient(
          90deg,
          transparent 0,
          transparent 92px,
          rgba(91, 225, 255, 0.05) 93px,
          transparent 94px
        ),
        repeating-linear-gradient(
          0deg,
          transparent 0,
          transparent 54px,
          rgba(91, 225, 255, 0.04) 55px,
          transparent 56px
        );
      mask-image: linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent);
      opacity: 0.5;
      transform: perspective(420px) rotateX(58deg) scale(1.35) translateY(18%);
      transform-origin: center bottom;
      animation: station-load-grid 7s linear infinite;
    }

    &::after {
      content: '';
      position: absolute;
      inset: 18% 22%;
      z-index: -1;
      border: 1px solid rgba(104, 234, 255, 0.15);
      border-radius: 22px;
      box-shadow:
        0 0 0 1px rgba(104, 234, 255, 0.05) inset,
        0 0 48px rgba(77, 208, 255, 0.1);
      opacity: 0.85;
      animation: station-load-frame 2.8s ease-in-out infinite;
    }
  }

  &__model-state-grid,
  &__model-state-glow {
    position: absolute;
    pointer-events: none;
  }

  &__model-state-grid {
    inset: 0;
    background:
      linear-gradient(90deg, transparent 0 49.8%, rgba(105, 237, 255, 0.16) 50%, transparent 50.2%),
      linear-gradient(0deg, transparent 0 49.8%, rgba(105, 237, 255, 0.12) 50%, transparent 50.2%);
    background-size: 180px 180px;
    mask-image: radial-gradient(circle at center, #000 0%, transparent 70%);
    opacity: 0.18;
  }

  &__model-state-glow {
    width: min(620px, 90vw);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(69, 219, 255, 0.2), rgba(69, 219, 255, 0.06) 34%, transparent 68%);
    filter: blur(8px);
    opacity: 0.8;
    animation: station-load-glow 2.6s ease-in-out infinite;
  }

  &__model-state-card {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 15px;
    width: min(430px, calc(100% - 32px));
    min-height: 92px;
    padding: 18px 20px;
    border: 1px solid rgba(113, 231, 255, 0.46);
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(8, 36, 52, 0.9), rgba(5, 20, 35, 0.78)),
      rgba(5, 22, 36, 0.82);
    box-shadow:
      0 22px 56px rgba(0, 7, 17, 0.45),
      0 0 0 1px rgba(221, 252, 255, 0.04) inset,
      0 0 28px rgba(77, 208, 255, 0.12);
    backdrop-filter: blur(14px) saturate(145%);
  }

  &__model-state-spinner {
    position: relative;
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    border: 2px solid rgba(138, 239, 255, 0.2);
    border-top-color: #8cf1ff;
    border-right-color: rgba(118, 230, 255, 0.7);
    border-radius: 50%;
    box-shadow: 0 0 18px rgba(77, 208, 255, 0.34);
    animation: station-load-spin 0.9s linear infinite;

    &::before {
      content: '';
      position: absolute;
      inset: 6px;
      border: 1px solid rgba(156, 246, 255, 0.28);
      border-radius: inherit;
    }

    i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #d9fcff;
      box-shadow: 0 0 10px rgba(217, 252, 255, 0.9);
    }
  }

  &__model-state-copy {
    min-width: 0;

    strong,
    small {
      display: block;
    }

    strong {
      color: #effeff;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1.35;
    }

    small {
      margin-top: 6px;
      color: rgba(190, 231, 237, 0.7);
      font-size: 11px;
      line-height: 1.4;
    }
  }

  &__model-state-status {
    align-self: flex-start;
    margin-left: auto;
    padding: 4px 7px;
    border: 1px solid rgba(129, 235, 255, 0.26);
    border-radius: 999px;
    color: rgba(164, 241, 255, 0.82);
    font: 800 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    white-space: nowrap;

    &::before {
      content: '';
      display: inline-block;
      width: 5px;
      height: 5px;
      margin: 0 5px 1px 0;
      border-radius: 50%;
      background: #71e9fa;
      box-shadow: 0 0 8px rgba(113, 233, 250, 0.75);
      animation: station-load-pulse 1.1s ease-in-out infinite;
    }
  }

  &__model-state--fallback {
    .nurse-station-visual__model-state-card {
      border-color: rgba(238, 184, 92, 0.42);
      box-shadow:
        0 22px 56px rgba(0, 7, 17, 0.45),
        0 0 0 1px rgba(255, 237, 196, 0.04) inset,
        0 0 28px rgba(245, 190, 92, 0.1);
    }

    .nurse-station-visual__model-state-spinner {
      border-color: rgba(250, 200, 111, 0.28);
      border-top-color: #ffd083;
      border-right-color: rgba(245, 190, 92, 0.7);
      box-shadow: 0 0 18px rgba(245, 190, 92, 0.24);
      animation: none;
    }

    .nurse-station-visual__model-state-status {
      border-color: rgba(238, 184, 92, 0.35);
      color: rgba(255, 216, 145, 0.9);

      &::before {
        background: #f0bd68;
        box-shadow: 0 0 8px rgba(240, 189, 104, 0.72);
        animation: none;
      }
    }
  }
}

@keyframes station-load-pulse {
  50% { opacity: 0.35; }
}

@keyframes station-load-spin {
  to { transform: rotate(360deg); }
}

@keyframes station-load-grid {
  to { transform: perspective(420px) rotateX(58deg) scale(1.35) translateY(28%); }
}

@keyframes station-load-frame {
  0%, 100% { opacity: 0.42; transform: scale(0.98); }
  50% { opacity: 0.9; transform: scale(1.02); }
}

@keyframes station-load-glow {
  0%, 100% { opacity: 0.52; transform: scale(0.92); }
  50% { opacity: 0.9; transform: scale(1.04); }
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
    padding: 18px 12px;
  }

  .nurse-station-visual__model-state-card {
    gap: 11px;
    width: min(430px, calc(100% - 12px));
    min-height: 82px;
    padding: 15px 14px;
  }

  .nurse-station-visual__model-state-spinner {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }

  .nurse-station-visual__model-state-copy strong {
    font-size: 13px;
  }

  .nurse-station-visual__model-state-copy small {
    font-size: 10px;
  }

  .nurse-station-visual__model-state-status {
    display: none;
  }
}
</style>
