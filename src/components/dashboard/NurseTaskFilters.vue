<script setup lang="ts">
import type { TaskEvidenceFilter } from '@/core/nurse-task-filter';
defineProps<{ count: number }>();
const query = defineModel<string>('query', { required: true });
const evidence = defineModel<TaskEvidenceFilter>('evidence', { required: true });
</script>

<template>
  <div class="nurse-task-filters" aria-label="房床与状态筛选">
    <label>房床搜索<input v-model="query" type="search" maxlength="100" placeholder="病房、床位名称或编码"></label>
    <label>记录状态<select v-model="evidence">
      <option value="all">全部记录</option><option value="pending">待处理（本次记录）</option><option value="retained">状态待确认</option>
    </select></label>
    <p role="status">当前筛选 {{ count }} 项 · 仅筛选当前列表。</p>
    <button v-if="query || evidence !== 'all'" type="button" @click="query = ''; evidence = 'all'">清除房床与依据筛选</button>
  </div>
</template>

<style scoped>
.nurse-task-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; color: var(--workspace-ink, #dceef8); font-size: var(--sidebar-font-body, 16px); line-height: 1.7; }
label { display: grid; gap: 4px; min-width: 0; }
input, select, button { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; padding: 8px; border: 1px solid var(--station-border, #49758b); border-radius: 6px; color: inherit; background: var(--station-surface, #102735); font: inherit; }
p { grid-column: 1 / -1; margin: 0; font-size: var(--sidebar-font-caption, 14px); overflow-wrap: anywhere; }
button { grid-column: 1 / -1; cursor: pointer; }
input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
button:hover { box-shadow: inset 0 0 0 1px currentColor; }
@container (max-width: 420px) { .nurse-task-filters { grid-template-columns: minmax(0, 1fr); } }
</style>
