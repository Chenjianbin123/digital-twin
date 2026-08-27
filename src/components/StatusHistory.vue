<script setup lang="ts">
import type { StatusHistoryEntry } from '@/types/twin';

defineProps<{
  history: StatusHistoryEntry[];
}>();

function categoryLabel(category: StatusHistoryEntry['category']) {
  if (category === 'env')
    return '环境';
  if (category === 'call')
    return '呼叫';
  if (category === 'device')
    return '设备';
  return '输液';
}
</script>

<template>
  <section v-if="history.length" class="status-history">
    <h3>事件记录</h3>
    <ul>
      <li v-for="item in history" :key="item.id" :class="`status-history__item--${item.category}`">
        <span class="time">{{ item.time }}</span>
        <span class="category">{{ categoryLabel(item.category) }}</span>
        <span class="room">{{ item.roomName }}</span>
        <span v-if="item.category !== 'env'" class="bed">{{ item.bedName }}</span>
        <span class="label">{{ item.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.status-history {
  margin-top: 16px;
  padding: 12px;
  background: rgba(6, 20, 36, 0.28);
  border: 1px solid rgba(77, 208, 255, 0.11);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
    color: #9be8ff;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 160px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(77, 208, 255, 0.25) transparent;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb {
      background: rgba(77, 208, 255, 0.25);
      border-radius: 4px;
    }
  }

  li {
    display: grid;
    grid-template-columns: 52px 32px 44px 36px 1fr;
    gap: 4px;
    padding: 6px 0;
    font-size: 11px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(174, 204, 229, 0.82);
  }

  &__item--env {
    grid-template-columns: 52px 32px 44px 1fr;
    .bed { display: none; }
    .label { color: #ffb74d; }
  }

  &__item--infusion .label {
    color: #4fc3f7;
  }

  &__item--call .label {
    color: #f48fb1;
  }

  &__item--device .label {
    color: #ffb74d;
  }

  .category {
    color: rgba(144, 174, 199, 0.82);
  }

  .time {
    font-variant-numeric: tabular-nums;
    color: rgba(144, 174, 199, 0.72);
  }

  .room,
  .bed {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
