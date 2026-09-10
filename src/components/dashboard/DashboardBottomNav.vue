<script setup lang="ts">
import { computed } from 'vue';
import type { TwinSceneType, WardInteriorView } from '@/types/twin';

const props = defineProps<{
  sceneType: TwinSceneType;
  wardInteriorView?: WardInteriorView;
  isSimulating?: boolean;
  dataSource?: 'mock' | 'remote' | 'database';
  compact?: boolean;
}>();

const emit = defineEmits<{
  setSceneType: [type: TwinSceneType];
  setWardInteriorView: [view: WardInteriorView];
  toggleSimulation: [];
}>();

const sceneItems = computed(() => [
  { key: 'nurse-station', label: '护士站', icon: 'station', type: 'nurse-station' as const },
  { key: 'ward', label: '病房走廊', icon: 'ward', type: 'ward' as const },
  { key: 'ward-interior', label: '病房内', icon: 'interior', type: 'ward-interior' as const },
]);

const interiorItems = computed(() => [
  { key: '3d', label: '3D', view: '3d' as const },
  { key: 'plan', label: '2.5D', view: 'plan' as const },
]);
</script>

<template>
  <nav class="dash-bottom" :class="{ 'dash-bottom--compact': props.compact }" aria-label="场景切换">
    <div class="dash-bottom__main">
      <button
        v-for="item in sceneItems"
        :key="item.key"
        type="button"
        class="dash-bottom__item"
        :aria-pressed="props.sceneType === item.type"
        :class="{
          'dash-bottom__item--active': props.sceneType === item.type,
          'dash-bottom__item--corridor': item.type === 'ward',
        }"
        @click="emit('setSceneType', item.type)"
      >
        <svg class="dash-bottom__scene-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-if="item.icon === 'station'" d="M4 21v-7h16v7M2 21h20M7 14V4h10v10M10 8h4M12 6v4"/>
          <path v-else-if="item.icon === 'ward'" d="M3 21V3h18v18M8 21V8h8v13M3 3l5 5m13-5-5 5M11 15h1"/>
          <path v-else d="M3 20V6m0 9h18v5M3 11h6v4m0-5h10a2 2 0 0 1 2 2v3M6 8h1"/>
        </svg>
        <span class="dash-bottom__label">{{ item.label }}</span>
      </button>
    </div>

    <div v-if="props.sceneType === 'ward-interior'" class="dash-bottom__sub">
      <button
        v-for="item in interiorItems"
        :key="item.key"
        type="button"
        class="dash-bottom__sub-item"
        :class="{ 'dash-bottom__sub-item--active': props.wardInteriorView === item.view }"
        @click="emit('setWardInteriorView', item.view)"
      >
        {{ item.label }}
      </button>
    </div>

    <button
      v-if="props.dataSource === 'mock'"
      type="button"
      class="dash-bottom__sim"
      :class="{ 'dash-bottom__sim--on': props.isSimulating }"
      @click="emit('toggleSimulation')"
    >
      <span class="dash-bottom__icon dash-bottom__icon--sim" aria-hidden="true" />
      <span class="dash-bottom__label">模拟推送</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.dash-bottom {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 24;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;

  &__main,
  &__sub,
  &__sim {
    pointer-events: auto;
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    @include dash-glass-panel;
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(14, 46, 68, 0.86), rgba(6, 25, 42, 0.9)),
      rgba(6, 18, 32, 0.72);
    border-color: rgba(93, 219, 255, 0.2);
    box-shadow:
      0 14px 34px rgba(0, 13, 24, 0.36),
      0 0 0 1px rgba(255, 255, 255, 0.035) inset,
      0 0 28px rgba(77, 208, 255, 0.12);
  }

  &__sub {
    display: flex;
    gap: 6px;
    padding: 4px 8px;
    @include dash-glass-panel;
    border-radius: 999px;
  }

  &__sub-item {
    padding: 5px 14px;
    border: 1px solid rgba(77, 208, 255, 0.25);
    border-radius: 999px;
    background: transparent;
    color: rgba(200, 225, 245, 0.88);
    font-size: dash-font(11);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;

    &--active {
      background: rgba(25, 118, 210, 0.4);
      border-color: rgba(129, 212, 250, 0.6);
      color: #4deaff;
    }
  }

  &__item,
  &__sim {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 68px;
    padding: 7px 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, box-shadow 0.15s;

    &:hover {
      background: rgba(77, 208, 255, 0.1);
    }

    &--active {
      background: linear-gradient(180deg, rgba(31, 139, 202, 0.46), rgba(10, 71, 116, 0.34));
      box-shadow:
        0 0 18px rgba(77, 208, 255, 0.22),
        inset 0 0 0 1px rgba(129, 212, 250, 0.12);

      .dash-bottom__icon {
        border-color: rgba(77, 208, 255, 0.75);
        box-shadow: 0 0 12px rgba(77, 208, 255, 0.45);
      }

      .dash-bottom__label {
        color: #4deaff;
      }
    }

    &--corridor {
      min-width: 92px;
      padding-inline: 13px;

      .dash-bottom__label {
        font-size: dash-font(10);
        letter-spacing: 0.02em;
      }
    }
  }

  &__sim {
    flex-direction: row;
    gap: 8px;
    min-width: 0;
    padding: 6px 14px;
    @include dash-glass-panel;
    border-radius: 999px;

    &--on .dash-bottom__label {
      color: #ffb74d;
    }
  }

  &__icon {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    border: 1px solid rgba(77, 208, 255, 0.35);
    background: radial-gradient(circle at 35% 30%, rgba(77, 208, 255, 0.22), rgba(0, 40, 80, 0.14));
    position: relative;
    flex-shrink: 0;

    &::after {
      content: '';
      position: absolute;
      inset: 7px;
      background: rgba(77, 208, 255, 0.85);
      border-radius: 2px;
    }

    &--station::after {
      inset: 8px 5px;
      border-radius: 1px;
      box-shadow: 0 -5px 0 -1px rgba(77, 208, 255, 0.85);
    }

    &--ward::after {
      clip-path: polygon(50% 12%, 88% 38%, 88% 82%, 12% 82%, 12% 38%);
    }

    &--interior::after {
      inset: 8px 6px;
      border-radius: 1px;
      box-shadow: 0 0 0 1px rgba(77, 208, 255, 0.35);
    }

    &--sim::after {
      border-radius: 50%;
      width: 6px;
      height: 6px;
      top: 10px;
      left: 10px;
      animation: sim-pulse 1.5s ease-in-out infinite;
    }
  }

  &__sim .dash-bottom__icon {
    width: 22px;
    height: 22px;
  }

  &__label {
    font-size: dash-font(10);
    font-weight: 600;
    color: rgba(200, 225, 245, 0.88);
    white-space: nowrap;
  }

  &--compact {
    bottom: 12px;

    .dash-bottom__main {
      padding: 4px 7px;
      background:
        linear-gradient(180deg, rgba(12, 40, 60, 0.66), rgba(5, 22, 38, 0.74)),
        rgba(6, 18, 32, 0.48);
      border-color: rgba(93, 219, 255, 0.12);
      box-shadow:
        0 10px 24px rgba(0, 13, 24, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.025) inset;
      backdrop-filter: blur(8px);
    }

    .dash-bottom__item {
      min-width: 60px;
      padding: 6px 9px;
    }

    .dash-bottom__item--corridor {
      min-width: 86px;
      padding-inline: 11px;
    }

    .dash-bottom__icon {
      width: 22px;
      height: 22px;
      opacity: 0.84;
    }

    .dash-bottom__label {
      font-size: dash-font(9);
      color: rgba(200, 225, 245, 0.76);
    }
  }

  @include down($bp-sm) {
    left: 8px;
    right: 8px;
    transform: none;
    width: calc(100% - 16px);

    &__main {
      width: 100%;
      justify-content: space-around;
      border-radius: 12px;
    }

    &__item {
      min-width: 0;
      flex: 1 1 0;
      padding: 6px 8px;
    }

    &__label {
      font-size: dash-font(10);
    }
  }
}

@media (min-width: 769px) and (max-width: 1023px) {
  .dash-bottom {
    bottom: calc(var(--mobile-panel-height) + 12px + env(safe-area-inset-bottom));
    width: min(100% - 24px, 560px);

    &__main {
      gap: 2px;
      padding: 4px 6px;
    }

    &__item,
    &__sim {
      min-width: 58px;
      padding: 6px 8px;
    }

    &__item--corridor {
      min-width: 78px;
      padding-inline: 9px;
    }

    &__icon {
      width: 22px;
      height: 22px;
    }

    &__label {
      font-size: dash-font(9);
    }
  }
}

@media (max-width: 768px) {
  .dash-bottom {
    bottom: calc(var(--mobile-panel-height) + 10px + env(safe-area-inset-bottom));
    gap: 6px;

    &__sub {
      max-width: 100%;
    }

    &__sub-item {
      min-width: 0;
      flex: 1 1 0;
      padding-inline: 10px;
    }
  }
}

@keyframes sim-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.dash-bottom {
  &__main { max-width: 100%; }
  &__item, &__sim, &__sub-item { min-height: 40px; }
  &__label, &.dash-bottom--compact .dash-bottom__label,
  &__item--corridor .dash-bottom__label { font-size: dash-font(12); }
}
@media (max-width: 1023px) {
  .dash-bottom {
    &__main { width: 100%; padding: 4px; gap: 0; border-radius: 12px; }
    &__item, &__item--corridor,
    &.dash-bottom--compact .dash-bottom__item { min-width: 0; flex: 1 1 0; padding-inline: 4px; }
    &__label { white-space: normal; overflow-wrap: anywhere; }
  }
}

/* 统一导航项尺寸，用图标和底色表达选中状态。 */
.dash-bottom.dash-bottom {
  left: 50%; right: auto; transform: translateX(-50%); width: max-content; max-width: calc(100% - 24px);
  .dash-bottom__main { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 4px; padding: 6px; border-radius: 14px; background: #102936f5; border: 1px solid #789eae55; box-shadow: 0 8px 24px #04141e30; }
  .dash-bottom__item { flex-direction: row; justify-content: center; gap: 8px; min-width: 106px; min-height: 46px; padding: 10px 14px; border: 1px solid transparent; border-radius: 9px; color: #abc6d2; background: transparent; box-shadow: none; }
  .dash-bottom__scene-icon { display: block; width: 20px; height: 20px; flex-shrink: 0; }
  .dash-bottom__label { font-size: 13px; font-weight: 500; color: inherit; white-space: nowrap; }
  .dash-bottom__item--active { color: #b6eee1; background: #24505a; border-color: #7fc6bd55; box-shadow: inset 0 1px #cfffee10; }
  .dash-bottom__item:hover { background: #21434f; }
  button:focus-visible { outline: 2px solid #8cdace; outline-offset: 2px; }
}
@media(max-width: 600px) {
  .dash-bottom.dash-bottom {
    .dash-bottom__main { padding: 4px; }
    .dash-bottom__item { flex-direction: column; min-width: 64px; padding: 7px 6px; gap: 4px; }
    .dash-bottom__label { font-size: 12px; }
  }
}
</style>
