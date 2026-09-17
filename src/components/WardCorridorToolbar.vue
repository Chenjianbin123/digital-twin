<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type { CorridorLayoutState } from '@/core/ward-corridor-layout';
import type { RoomSummary } from '@/core/area-summary';
import type { TwinAreaEntity } from '@/types/twin';

const props = defineProps<{
  area: TwinAreaEntity;
  summaries: RoomSummary[];
  layout: CorridorLayoutState;
  focusedRoomIndex: number;
  panelsVisible: boolean;
  alertTitle?: string;
}>();
const emit = defineEmits<{
  focus: [index: number]; enter: [index: number]; page: [page: number]; reset: []; retry: [];
}>();
const focused = computed(() => props.area.rooms[props.focusedRoomIndex]);
const expanded = ref(true);
const navigationId = useId();
const summary = computed(() => props.summaries[props.focusedRoomIndex]);
const visibleSlots = computed(() => props.layout.slots.filter(slot => slot.roomIndex !== null));
const unbound = computed(() => props.layout.mode === 'physical'
  ? props.area.rooms.map((room, index) => ({ room, index }))
    .filter(item => !props.layout.slots.some(slot => slot.roomIndex === item.index))
  : []);
function navigate(event: KeyboardEvent) {
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-room]')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
  buttons[next]?.click();
}
</script>

<template>
  <section class="corridor-tools" :class="{ 'corridor-tools--full': !panelsVisible }" aria-label="病房走廊导航" @keydown.esc.stop="emit('reset')">
    <header>
      <span class="corridor-tools__title">{{ area.rooms.length === 1 ? area.rooms[0]?.sickroomName : '病房走廊' }}<small>已接入 {{ area.rooms.length }} 间病房 · {{ layout.mode === 'physical' ? '已配置门位' : '分组示意，非实际位置' }}</small></span>
      <div class="corridor-tools__actions">
      <button v-if="area.rooms.length > 1" type="button" :aria-expanded="expanded" :aria-controls="navigationId" @click="expanded = !expanded">{{ expanded ? '收起房号' : '展开房号' }}</button>
      <button v-if="area.rooms.length === 1 && visibleSlots.length" type="button" @click="emit('focus', 0)">定位门口屏</button>
      <button type="button" @click="emit('reset')">恢复总览</button>
      </div>
    </header>
    <div v-show="expanded" :id="navigationId">
    <nav v-if="visibleSlots.length && area.rooms.length > 1" aria-label="定位病房" @keydown="navigate">
      <button v-for="slot in visibleSlots" :key="slot.doorNode" type="button" data-room
        :aria-pressed="slot.roomIndex === focusedRoomIndex"
        :data-priority="area.rooms[slot.roomIndex!]?.isOnline === false ? 'offline' : summaries[slot.roomIndex!]?.priority"
        :title="summaries[slot.roomIndex!]?.statusText"
        @click="emit('focus', slot.roomIndex!)">
        <strong>{{ slot.label }}</strong>
        <small>{{ area.rooms[slot.roomIndex!]?.isOnline === false ? '门口机离线' : summaries[slot.roomIndex!]?.statusText }}</small>
      </button>
    </nav>
    <p v-else-if="!visibleSlots.length" role="status">{{ area.rooms.length ? '本组暂无可定位病房' : '当前病区暂无已接入门口机' }}</p>
    <div v-if="area.rooms.length === 1 && !focused" class="corridor-tools__selected">
      <span>{{ area.rooms[0]?.isOnline === false ? '门口机离线' : summaries[0]?.statusText }}</span>
      <button type="button" @click="emit('enter', 0)">进入病房 →</button>
    </div>
    <div v-if="layout.pageCount > 1" class="corridor-tools__pages">
      <button type="button" :disabled="layout.page === 0" @click="emit('page', layout.page - 1)">上一组</button>
      <span>第 {{ layout.page + 1 }} / {{ layout.pageCount }} 组</span>
      <button type="button" :disabled="layout.page + 1 === layout.pageCount" @click="emit('page', layout.page + 1)">下一组</button>
    </div>
    </div>
    <div v-if="focused" class="corridor-tools__selected" role="status">
      <span><strong>{{ focused.sickroomName }}</strong> · {{ summary?.statusText }}
        <small v-if="alertTitle"> · {{ alertTitle }}</small>
        <small v-if="focused.isOnline === false"> · 门口机离线</small></span>
      <button type="button" @click="emit('enter', focusedRoomIndex)">进入病房 →</button>
    </div>
    <details v-if="layout.issues.length || unbound.length">
      <summary>门位与数据提示 {{ layout.issues.length }}</summary>
      <ul><li v-for="issue in layout.issues" :key="issue">{{ issue }}</li></ul>
      <button v-if="layout.issues.some(issue => issue.includes('模板加载失败'))" type="button" @click="emit('retry')">重试门口屏模板</button>
      <button v-for="item in unbound" :key="item.index" type="button" @click="emit('enter', item.index)">
        进入 {{ item.room.sickroomName }}
      </button>
    </details>
    <p v-if="expanded && area.rooms.length > 1" class="corridor-tools__hint">选择房号定位 <span>拖动旋转 · 滚轮缩放 · Esc 恢复总览</span></p>
  </section>
</template>

<style scoped>
.corridor-tools {
  position: absolute; top: 76px; left: 16px;
  right: calc(var(--scene-panel-width, 420px) + 16px); z-index: 12;
  padding: 8px 12px; border: 1px solid var(--station-border, #8eabbc);
  border-radius: 8px; color: var(--station-ink, #17384c);
  background: var(--station-surface, rgba(244, 250, 253, .96));
  box-shadow: 0 4px 16px #12334818; pointer-events: auto;
  font-family: inherit; font-size: 13px; line-height: 1.5;
}
.corridor-tools--full { right: 16px; }
:global(.digital-twin[data-theme='dark'] .corridor-tools) { background: #102735; color: #dcebf2; border-color: #456675; }
header, .corridor-tools__pages, .corridor-tools__selected {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
header { flex-wrap: wrap; }
.corridor-tools__title { display: flex; gap: 8px; align-items: center; font-weight: 600; }
.corridor-tools__title small { font-weight: 400; font-size: 11px; opacity: .75; }
.corridor-tools__actions { display: flex; gap: 6px; flex-shrink: 0; }
nav { display: flex; gap: 6px; overflow-x: auto; padding: 8px 2px; scrollbar-width: thin; }
button { font: inherit; color: inherit; cursor: pointer; border: 1px solid #7995a5; border-radius: 5px; background: transparent; min-height: 36px; padding: 4px 10px; }
nav button { flex: 1 0 72px; min-width: 0; max-width: 148px; text-align: left; border-color: #93aebb55; border-top: 3px solid #608f9d; background: #83abc50b; }
nav button[data-priority='calling'], nav button[data-priority='danger'], nav button[data-priority='offline'] { border-top-color: #d34c60; }
nav button[data-priority='warning'], nav button[data-priority='infusing'] { border-top-color: #b27b24; }
nav strong { display: block; max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
button:hover:not(:disabled):not([aria-pressed='true']) { background: #82b4c526; }
nav small { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button[aria-pressed="true"] { color: #f7fbfd; background: #075a83; border-color: #075a83; }
button:focus-visible, summary:focus-visible { outline: 3px solid #0088b8; outline-offset: 2px; }
button:disabled { opacity: .45; cursor: default; }
.corridor-tools__selected { padding-top: 8px; border-top: 1px solid #93aebb66; }
.corridor-tools__selected > span { min-width: 0; overflow-wrap: anywhere; }
.corridor-tools__selected button { flex-shrink: 0; }
.corridor-tools__pages { justify-content: center; }
.corridor-tools__hint { margin: 6px 0 0; font-size: 12px; opacity: .8; }
.corridor-tools__hint span { float: right; }
details { margin-top: 6px; max-height: 130px; overflow: auto; }
details summary { cursor: pointer; }
@media (max-width: 767px) {
  .corridor-tools { top: 96px; left: 8px; right: 8px; padding: 8px; font-size: 12px; }
  .corridor-tools__hint { display: none; }
  .corridor-tools__title { display: block; font-size: 11px; }
  .corridor-tools__title small { display: block; font-size: 10px; }
  .corridor-tools__actions { gap: 4px; }
  button { min-height: 44px; padding: 4px 8px; }
  nav button { flex-basis: 76px; }
  .corridor-tools__selected { align-items: flex-start; }
}
</style>
