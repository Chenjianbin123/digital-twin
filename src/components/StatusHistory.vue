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
  if (category === 'vital')
    return '体征';
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
  box-shadow: inset 0 1px 0 rgba(247, 251, 253, 0.035);

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
    border-bottom: 1px solid rgba(247, 251, 253, 0.05);
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

  &__item--vital .label {
    color: #ff9faa;
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

:global(.digital-twin[data-theme='light'] .status-history) {
  background: #f7fbfd !important;
  border: 1px solid #c5d5dd !important;
  box-shadow: 0 1px 2px rgba(35, 68, 84, 0.05) !important;
  color: #243944;
}

:global(.digital-twin[data-theme='light'] .status-history)::before {
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

:global(.digital-twin[data-theme='light'] .status-history .time),
:global(.digital-twin[data-theme='light'] .status-history .room),
:global(.digital-twin[data-theme='light'] .status-history .bed) {
  color: #5a717c !important;
}

:global(.digital-twin[data-theme='light'] .status-history .category) {
  color: #3a6572 !important;
  background: #eef4f7 !important;
  border: 1px solid #b7c9d2 !important;
  border-radius: 4px;
  padding: 1px 6px;
}

:global(.digital-twin[data-theme='light'] .status-history .label) {
  color: #243944 !important;
}

:global(.digital-twin[data-theme='light'] .status-history__item--call .label) {
  color: #8a4554 !important;
}

:global(.digital-twin[data-theme='light'] .status-history__item--env .label),
:global(.digital-twin[data-theme='light'] .status-history__item--device .label) {
  color: #7a5a28 !important;
}

:global(.digital-twin[data-theme='light'] .status-history__item--infusion .label) {
  color: #2f6f8a !important;
}

:global(.digital-twin[data-theme='light'] .status-history__item--vital .label) {
  color: #8a4554 !important;
}
</style>
