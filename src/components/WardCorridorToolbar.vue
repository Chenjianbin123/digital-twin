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
const expanded = ref(false);
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
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 }[event.key] ?? 0) + buttons.length) % buttons.length;
  buttons[next]?.focus();
  buttons[next]?.click();
}
</script>

<template>
  <section class="corridor-tools" aria-label="病房走廊导航" @keydown.esc.stop="emit('reset')">
    <header>
      <span class="corridor-tools__title">病房走廊<small>{{ area.rooms.length }} 间病房</small></span>
      <div class="corridor-tools__actions">
      <button v-if="area.rooms.length > 1" class="corridor-tools__toggle" type="button" :aria-expanded="expanded" :aria-controls="navigationId" @click="expanded = !expanded">{{ expanded ? '收起列表' : '查找病房' }}<span aria-hidden="true">{{ expanded ? '−' : '+' }}</span></button>
      <button v-if="area.rooms.length === 1 && visibleSlots.length" type="button" @click="emit('focus', 0)">定位门口屏</button>
      <button type="button" @click="emit('reset')">恢复总览</button>
      </div>
    </header>
    <p class="corridor-tools__mapping">{{ layout.mode === 'physical' ? '已配置门位' : '分组示意，非实际位置' }}</p>
    <div v-show="expanded || area.rooms.length <= 1" :id="navigationId" class="corridor-tools__body">
    <div v-if="expanded && area.rooms.length > 1" class="corridor-tools__list-heading"><span>选择病房定位</span><small>当前组 {{ visibleSlots.length }} 间</small></div>
    <nav v-if="visibleSlots.length && area.rooms.length > 1" aria-label="定位病房" @keydown="navigate">
      <button v-for="slot in visibleSlots" :key="slot.doorNode" type="button" data-room
        :aria-pressed="slot.roomIndex === focusedRoomIndex"
        :data-priority="area.rooms[slot.roomIndex!]?.isOnline === false ? 'offline' : summaries[slot.roomIndex!]?.priority"
        :title="`${slot.label} · ${area.rooms[slot.roomIndex!]?.isOnline === false ? '门口机离线' : summaries[slot.roomIndex!]?.statusText ?? '暂无状态'}`"
        @click="emit('focus', slot.roomIndex!)">
        <span class="corridor-tools__room-heading"><strong>{{ slot.label }}</strong><span v-if="slot.roomIndex === focusedRoomIndex" class="corridor-tools__current">已定位</span></span>
        <small>{{ area.rooms[slot.roomIndex!]?.isOnline === false ? '门口机离线' : summaries[slot.roomIndex!]?.statusText ?? '暂无状态' }}</small>
      </button>
    </nav>
    <p v-else-if="!visibleSlots.length" role="status">{{ area.rooms.length ? '本组暂无可定位病房' : '当前病区暂无已接入门口机' }}</p>
    <div v-if="area.rooms.length === 1 && !focused" class="corridor-tools__selected">
      <span><strong>{{ area.rooms[0]?.sickroomName }}</strong> · {{ area.rooms[0]?.isOnline === false ? '门口机离线' : summaries[0]?.statusText ?? '暂无状态' }}</span>
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
    <details class="corridor-tools__help"><summary>操作帮助</summary><p>点击房号定位，选择后可进入病房。拖动旋转，滚轮缩放；按 Esc 恢复总览。</p></details>
  </section>
</template>

<style scoped>
.corridor-tools {
  --ct-surface: #f2f8fb; --ct-card: #ffffff; --ct-ink: #1d4054;
  --ct-muted: #546e7f; --ct-border: #b8d3df; --ct-accent: #167d99;
  --ct-active: #dceff5; --ct-danger: #b63351; --ct-warning: #92601b;
  box-sizing: border-box; position: absolute; top: 76px; left: 16px;
  width: 376px; max-width: calc(100% - 32px); max-height: calc(100% - 100px);
  overflow-y: auto; overflow-x: hidden; z-index: 12; pointer-events: auto;
  padding: 14px; border: 1px solid var(--ct-border); border-top: 2px solid var(--ct-accent);
  border-radius: 10px; color: var(--ct-ink); background: var(--ct-surface);
  box-shadow: 0 8px 28px #12334820;
  font-family: inherit; font-size: 13px; line-height: 1.5; scrollbar-width: thin;
}
:global(.digital-twin[data-theme='dark'] .corridor-tools) {
  --ct-surface: #102936; --ct-card: #163441; --ct-ink: #e0eef4;
  --ct-muted: #a4bdca; --ct-border: #365e70; --ct-accent: #67c7dc;
  --ct-active: #214a5b; --ct-danger: #ff91a5; --ct-warning: #efc37d;
  box-shadow: 0 10px 30px #06172055;
}
header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.corridor-tools__title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 650; }
.corridor-tools__title small { font-size: 11px; font-weight: 500; color: var(--ct-muted); padding-left: 10px; border-left: 1px solid var(--ct-border); }
.corridor-tools__actions { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--ct-border); border-radius: 6px; background: transparent; min-height: 36px; padding: 6px 12px; }
button:hover:not(:disabled) { border-color: var(--ct-accent); background: var(--ct-active); }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--ct-accent); outline-offset: 3px; }
button:disabled { opacity: .45; cursor: default; }
.corridor-tools__toggle { color: var(--ct-accent); background: var(--ct-active); border-color: var(--ct-accent); }
.corridor-tools__toggle span { margin-left: 12px; font-size: 16px; }
.corridor-tools__mapping { margin: 10px 0 0; font-size: 11px; color: var(--ct-muted); }
.corridor-tools__body { margin-top: 12px; }
.corridor-tools__list-heading { display: flex; justify-content: space-between; align-items: center; color: var(--ct-muted); font-size: 12px; padding-top: 10px; border-top: 1px solid var(--ct-border); }
.corridor-tools__list-heading small { font-size: 11px; }
nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: min(300px, 38vh); overflow-y: auto; overflow-x: hidden; padding: 8px 3px; scrollbar-width: thin; scrollbar-color: var(--ct-border) transparent; }
nav button { position: relative; min-width: 0; text-align: left; padding: 10px 12px; background: var(--ct-card); border-left: 3px solid var(--ct-accent); }
nav button[data-priority='offline'] { border-left-color: var(--ct-muted); }
nav button[data-priority='calling'], nav button[data-priority='danger'] { border-left-color: var(--ct-danger); }
nav button[data-priority='warning'], nav button[data-priority='infusing'] { border-left-color: var(--ct-warning); }
.corridor-tools__room-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
nav strong { font-size: 17px; font-weight: 650; letter-spacing: .025em; overflow-wrap: anywhere; }
nav small { display: block; margin-top: 5px; color: var(--ct-muted); font-size: 12px; overflow-wrap: anywhere; }
nav button[data-priority='calling'] small, nav button[data-priority='danger'] small { color: var(--ct-danger); }
nav button[aria-pressed='true'] { background: var(--ct-active); border-color: var(--ct-accent); box-shadow: inset 0 0 0 1px var(--ct-accent); }
.corridor-tools__current { color: var(--ct-accent); font-size: 10px; white-space: nowrap; }
.corridor-tools__selected { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 12px; border: 1px solid var(--ct-border); border-radius: 6px; background: var(--ct-active); flex-wrap: wrap; }
.corridor-tools__selected > span { min-width: 0; overflow-wrap: anywhere; }
.corridor-tools__selected button { flex-shrink: 0; border-color: var(--ct-accent); color: var(--ct-accent); }
.corridor-tools__pages { display: flex; justify-content: space-between; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap; font-size: 12px; }
details { margin-top: 10px; color: var(--ct-muted); font-size: 12px; }
details summary { cursor: pointer; width: fit-content; }
details ul { padding-left: 20px; overflow-wrap: anywhere; }
details p { margin: 8px 0 0; }
details button { margin-top: 6px; max-width: 100%; overflow-wrap: anywhere; }
.corridor-tools__help { padding-top: 8px; border-top: 1px solid var(--ct-border); font-size: 11px; }
@media (max-width: 767px) {
  .corridor-tools { top: 96px; left: 8px; width: 360px; max-width: calc(100% - 16px); max-height: calc(100% - 116px); padding: 12px; }
  button { min-height: 44px; }
  nav button { padding: 8px; }
  nav strong { font-size: 16px; }
}
</style>
