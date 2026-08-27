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
        :class="{
          'dash-bottom__item--active': props.sceneType === item.type,
          'dash-bottom__item--corridor': item.type === 'ward',
        }"
        @click="emit('setSceneType', item.type)"
      >
        <span class="dash-bottom__icon" :class="`dash-bottom__icon--${item.icon}`" aria-hidden="true" />
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
    font-size: 11px;
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
        font-size: 10px;
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
    font-size: 10px;
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
      font-size: 9px;
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
      font-size: 10px;
    }
  }
}

@keyframes sim-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
