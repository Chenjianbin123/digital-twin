<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import SidebarSectionToggle from './dashboard/SidebarSectionToggle.vue';
import { resolveHistoryRoom } from '@/core/corridor-room-browser';
import type { HistoryCategory, StatusHistoryEntry, TwinAreaEntity } from '@/types/twin';

const props = defineProps<{
  history: StatusHistoryEntry[];
  collapsible?: boolean;
  browsable?: boolean;
  area?: TwinAreaEntity | null;
}>();
const emit = defineEmits<{ locate: [id: string] }>();

const collapsed = ref(false);
const bodyId = useId();
const category = ref<HistoryCategory | 'all'>('all');
const categories: HistoryCategory[] = ['call', 'infusion', 'env', 'device', 'vital'];
const visibleHistory = computed(() => props.history
  .filter(item => !props.browsable || category.value === 'all' || item.category === category.value)
  .map(item => ({ item, roomIndex: props.browsable ? resolveHistoryRoom(item, props.area ?? null) : null })));
watch(() => props.area?.areaCode, () => { category.value = 'all'; });

function categoryLabel(category: StatusHistoryEntry['category']) {
  if (category === 'env')
    return '环境';
  if (category === 'call')
    return '呼叫';
  if (category === 'device')
    return '设备';
  if (category === 'vital')
    return '体征';
  return '输液';
}
</script>

<template>
  <section v-if="history.length" class="status-history" :class="{ 'sidebar-section--collapsed': collapsible && collapsed }">
    <div v-if="collapsible" class="status-history__heading"><h3>事件记录 <small>{{ history.length }}</small></h3><SidebarSectionToggle v-model="collapsed" label="事件记录" :controls="bodyId" /></div>
    <h3 v-else>事件记录</h3>
    <div :id="bodyId" v-show="!collapsible || !collapsed">
    <div v-if="browsable" class="status-history__filters">
      <label :for="`${bodyId}-category`">事件类别</label>
      <select :id="`${bodyId}-category`" v-model="category">
        <option value="all">全部事件</option>
        <option v-for="value in categories" :key="value" :value="value">{{ categoryLabel(value) }}</option>
      </select>
      <span role="status">显示 {{ visibleHistory.length }} / {{ history.length }} 条</span>
    </div>
    <p v-if="browsable" class="status-history__hint">仅定位已关联当前病区的记录；历史事件不代表当前仍有告警。</p>
    <p v-if="!visibleHistory.length" class="status-history__empty">暂无此类事件，可切换至全部事件。</p>
    <ul class="status-history__list" aria-label="事件记录列表">
      <li v-for="{ item, roomIndex } in visibleHistory" :key="item.id" :class="`status-history__item--${item.category}`">
        <div class="status-history__entry">
          <div class="status-history__meta">
            <span class="status-history__time" data-history-field="time">{{ item.time }}</span>
            <span class="status-history__category" data-history-field="category">{{ categoryLabel(item.category) }}</span>
          </div>
          <p class="status-history__message" data-history-field="label">{{ item.label }}</p>
          <div class="status-history__location">
            <span class="status-history__location-label">位置</span>
            <span class="status-history__room" data-history-field="room">{{ item.roomName || '未提供' }}</span>
            <template v-if="item.category !== 'env' && item.bedName">
              <span aria-hidden="true">·</span>
              <span class="status-history__bed" data-history-field="bed">{{ item.bedName }}</span>
            </template>
          </div>
          <div v-if="browsable" class="status-history__action">
            <button v-if="roomIndex !== null" type="button" :aria-label="`定位病房：${area?.rooms[roomIndex]?.sickroomName}`" @click="emit('locate', item.id)">定位病房 <span aria-hidden="true">→</span></button>
            <span v-else>暂无法定位</span>
          </div>
        </div>
      </li>
    </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.status-history {
  --history-ink: var(--sidebar-ink, #eaf5fc);
  --history-muted: var(--sidebar-muted, #a7c7db);
  --history-accent: var(--sidebar-accent, #73d4f4);
  --history-line: var(--sidebar-line, #426b81);
  --history-inset: var(--sidebar-inset, #15354a);
  &__heading { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  &__heading h3 { display: flex; align-items: center; gap: 8px; margin: 0; }
  &__heading small { font-size: var(--sidebar-font-caption, 14px); font-weight: 600; padding: 0 8px; border: 1px solid var(--history-line); border-radius: 12px; color: var(--history-accent); background: var(--history-inset); }
  margin-top: 16px;
  padding: 12px;
  background: rgba(6, 20, 36, 0.28);
  border: 1px solid rgba(77, 208, 255, 0.11);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(247, 251, 253, 0.035);

  h3 {
    margin: 0 0 8px;
    font-size: var(--sidebar-font-heading, 18px);
    font-weight: 700;
    color: #9be8ff;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 320px;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(77, 208, 255, 0.25) transparent;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb {
      background: rgba(77, 208, 255, 0.25);
      border-radius: 4px;
    }
  }
  &__list:focus-visible { outline: 2px solid var(--history-accent); outline-offset: -2px; border-radius: 8px; }

  li {
    display: block;
    padding: 6px 0;
    border: 0;
  }

  // 独立字段类与分组布局，避免旧主题的网格坐标影响记录内部排版。
  &__entry {
    grid-column: 1 / -1; min-width: 0; padding: 12px;
    border: 1px solid var(--history-line); border-left: 2px solid var(--history-accent);
    border-radius: 8px; background: color-mix(in srgb, var(--history-inset) 60%, transparent);
    color: var(--history-ink); font-size: var(--sidebar-font-body, 16px);
    line-height: var(--sidebar-line-body, 1.6);
  }
  &__meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
  &__time { color: var(--history-muted); font-size: inherit; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; min-width: 0; }
  &__category { flex: none; color: var(--history-accent); font-size: inherit; font-weight: 500; line-height: 1.4; padding: 2px 8px; border: 1px solid var(--history-line); border-radius: 5px; background: color-mix(in srgb, var(--history-accent) 8%, transparent); }
  &__message { margin: 8px 0 4px; color: var(--history-ink); font-size: inherit; font-weight: 600; overflow-wrap: anywhere; }
  &__location { display: flex; flex-wrap: wrap; gap: 0 8px; align-items: baseline; color: var(--history-muted); font-size: inherit; }
  &__location-label { flex: none; }
  &__room, &__bed { min-width: 0; overflow-wrap: anywhere; }
  &__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; color: var(--history-ink); font-size: var(--sidebar-font-body, 16px); }
  &__filters label { font-weight: 600; }
  &__filters select, &__action button { min-height: 36px; max-width: 100%; padding: 6px 12px; border: 1px solid var(--history-line); border-radius: 8px; background: var(--history-inset); color: var(--history-ink); font: inherit; cursor: pointer; }
  &__filters > span { color: var(--history-muted); font-size: var(--sidebar-font-caption, 14px); }
  &__hint, &__empty { margin: 8px 0; color: var(--history-muted); font-size: var(--sidebar-font-caption, 14px); line-height: 1.6; }
  &__empty { padding: 12px; border: 1px dashed var(--history-line); border-radius: 8px; }
  &__action { display: flex; justify-content: flex-end; margin-top: 8px; color: var(--history-muted); font-size: var(--sidebar-font-caption, 14px); }
  &__action button { color: var(--history-accent); }
  &__action button:hover { border-color: var(--history-accent); background: color-mix(in srgb, var(--history-accent) 12%, var(--history-inset)); }
  &__filters select:focus-visible, &__action button:focus-visible { outline: 2px solid var(--history-accent); outline-offset: 2px; }
}
@media (pointer: coarse) { .status-history__filters select, .status-history__action button { min-height: 44px; } }

:global(.digital-twin[data-theme='light'] .status-history) {
  --history-ink: var(--sidebar-ink, #243944);
  --history-muted: var(--sidebar-muted, #5a717c);
  --history-accent: var(--sidebar-accent, #087fae);
  --history-line: var(--sidebar-line, #c5d5dd);
  --history-inset: var(--sidebar-inset, #edf7ff);
  background: #f7fbfd !important;
  border: 1px solid #c5d5dd !important;
  box-shadow: 0 1px 2px rgba(35, 68, 84, 0.05) !important;
  color: #243944;
}

:global(.digital-twin[data-theme='light'] .status-history::before) {
  display: none !important;
}

:global(.digital-twin[data-theme='light'] .status-history h3) {
  color: #294c58 !important;
  text-shadow: none !important;
  letter-spacing: 0.04em;
}

:global(.digital-twin[data-theme='light'] .status-history ul) {
  scrollbar-color: #9aafb8 transparent;
}

:global(.digital-twin[data-theme='light'] .status-history ul::-webkit-scrollbar-thumb) {
  background: #9aafb8 !important;
}

:global(.digital-twin[data-theme='light'] .status-history li) {
  color: #5a717c !important;
  border-bottom-color: #dde6eb !important;
}

:global(.digital-twin[data-theme='light'] .status-history li:hover) {
  background: rgba(61, 117, 133, 0.08) !important;
  transform: none;
}

</style>
