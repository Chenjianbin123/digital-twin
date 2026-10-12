<script setup lang="ts">
import { ref } from 'vue';
import { buildInspectionChecklist } from '@/core/inspection-checklist';
import type { InspectionAssociation } from '@/types/inspection';
const props = defineProps<{ areaName: string; syncedAt: string | null; association: InspectionAssociation }>();
const feedback = ref('');
function download() {
  let url: string | undefined;
  const anchor = document.createElement('a');
  try {
    const content = buildInspectionChecklist(props);
    url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    anchor.href = url;
    anchor.download = `巡视房床核对清单-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    feedback.value = '已发起下载，仅包含房床核对信息。';
  }
  catch {
    feedback.value = '导出失败，请重试；也可使用下方清单核对。';
  }
  finally {
    anchor.remove();
    if (url) { const objectUrl = url; setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
  }
}
</script>

<template>
  <div class="inspection-download">
    <button type="button" :disabled="!association.issues.length" @click="download">导出房床核对清单</button>
    <p>导出当前 {{ association.issues.length }} 组核对信息；另有 {{ association.omittedIssueCount ?? 0 }} 条未列出，清单可能不完整。</p>
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </div>
</template>

<style scoped>
.inspection-download { margin: 12px 0; font-size: var(--sidebar-font-body, 16px); line-height: 1.7; }
button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--station-border, #49758b); border-radius: 6px; color: var(--workspace-ink, #dceef8); background: var(--station-surface, #102735); font: inherit; cursor: pointer; }
button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px currentColor; }
button:disabled { opacity: .5; cursor: not-allowed; }
p { margin: 8px 0; overflow-wrap: anywhere; font-size: var(--sidebar-font-caption, 14px); }
</style>
