<script setup lang="ts">
import { computed } from 'vue';
import type { RoomSummary } from '@/core/area-summary';
import type { TwinWardEntity } from '@/types/twin';

const props = defineProps<{
  rooms: TwinWardEntity[];
  roomSummaries: RoomSummary[];
  focusedRoomIndex: number;
}>();

const emit = defineEmits<{
  focusRoom: [index: number];
  enterRoom: [index: number];
}>();

const roomItems = computed(() =>
  props.rooms.map((room, index) => {
    const summary = props.roomSummaries[index];
    return {
      key: room.sickroomCode,
      label: room.sickroomName,
      index,
      priority: summary?.priority ?? 'normal',
      active: index === props.focusedRoomIndex,
    };
  }),
);

const visible = computed(() => props.rooms.length > 1);
</script>

<template>
  <nav v-if="visible" class="dash-area-nav" aria-label="区域定位">
    <ul class="dash-area-nav__list">
      <li
        v-for="item in roomItems"
        :key="item.key"
        class="dash-area-nav__item"
        :class="[
          `dash-area-nav__item--${item.priority}`,
          { 'dash-area-nav__item--active': item.active },
        ]"
      >
        <button
          type="button"
          class="dash-area-nav__btn"
          @click="emit('focusRoom', item.index)"
          @dblclick="emit('enterRoom', item.index)"
        >
          <span class="dash-area-nav__dot" aria-hidden="true" />
          {{ item.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.dash-area-nav {
  position: absolute;
  top: 80px;
  left: 36%;
  z-index: 12;
  width: 70%;
  padding: 8px 10px;
  border: 1px solid rgba(68, 221, 255, 0.34);
  border-radius: 12px;
  background:
    linear-gradient(105deg, rgba(3, 24, 38, 0.68), rgba(4, 47, 70, 0.42));
  box-shadow:
    0 10px 26px rgba(0, 0, 0, 0.2),
    0 0 16px rgba(38, 199, 244, 0.08),
    inset 2px 0 0 rgba(71, 226, 255, 0.52),
    inset 0 1px 0 rgba(166, 242, 255, 0.1);
  backdrop-filter: blur(9px) saturate(125%);
  transform: translateX(-50%);
  pointer-events: auto;

  &::before {
    display: none;
  }

  &::after {
    display: none;
  }

  @include up($bp-xl) {
    width: min(980px, calc(100vw - var(--scene-panel-width, 500px) - 80px));
  }

  @media (min-width: 1280px) and (max-width: 1599px) {
    left: 42%;
    width: min(760px, calc(100vw - var(--scene-panel-width, 400px) - 72px));
  }

  @include between($bp-md, $bp-lg) {
    width: min(620px, calc(100vw - var(--scene-panel-width, 400px) - 48px));
  }

  @include down($bp-md) {
    display: none;
  }

  &__head {
    @include dash-section-head;
    margin-bottom: 7px;
    pointer-events: auto;
  }

  &__mark {
    @include dash-section-mark;
  }

  &__title {
    @include dash-section-title;
    color: #dff9ff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-shadow: 0 0 9px rgba(67, 222, 255, 0.5);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 7px;
    max-height: 42px;
    overflow-x: auto;
    overflow-y: hidden;
    overflow: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(72, 214, 255, 0.58) rgba(255, 255, 255, 0.06);

    &::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background: rgba(72, 214, 255, 0.58);
    }
  }

  &__item {
    pointer-events: auto;
    flex: 0 1 auto;

    &--active .dash-area-nav__btn {
      color: #fff;
      background: linear-gradient(135deg, rgba(0, 151, 208, 0.72), rgba(3, 92, 134, 0.68));
      border-color: rgba(118, 232, 255, 0.92);
      box-shadow:
        0 0 14px rgba(54, 210, 255, 0.3),
        inset 0 0 12px rgba(91, 229, 255, 0.12);
    }

    &--calling .dash-area-nav__dot { background: #f48fb1; }
    &--infusing .dash-area-nav__dot { background: #ffb74d; }
    &--offline .dash-area-nav__dot { background: #ef9a9a; }
  }

  &__btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: auto;
    max-width: 260px;
    min-height: 30px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 650;
    font-family: inherit;
    color: #eaf9ff;
    text-align: left;
    background: linear-gradient(135deg, rgba(13, 65, 91, 0.62), rgba(5, 37, 57, 0.58));
    border: 1px solid rgba(87, 215, 255, 0.5);
    border-radius: 5px;
    backdrop-filter: blur(5px);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    line-height: 1.35;
    white-space: nowrap;

    &:hover {
      border-color: rgba(77, 208, 255, 0.4);
      background: linear-gradient(135deg, rgba(11, 133, 180, 0.8), rgba(4, 78, 112, 0.78));
      color: #fff;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.26);
    }
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #42dcff;
    box-shadow: 0 0 7px rgba(66, 220, 255, 0.92);
  }
}
</style>
