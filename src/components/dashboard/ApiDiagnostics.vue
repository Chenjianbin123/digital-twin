<script setup lang="ts">
import { ref } from 'vue';
import { getRecentApiRequests } from '@/api/http-client';
import { buildApiDiagnosticReport, type SafeApiRequestRecord } from '@/core/api-diagnostics';
import { API_FAILURE_INFO } from '@/core/api-failure';
const records = ref<SafeApiRequestRecord[]>([]);
const feedback = ref('');
function refresh() { records.value = getRecentApiRequests(); feedback.value = ''; }
function onToggle(event: Event) { if ((event.target as HTMLDetailsElement).open) refresh(); }
function download() {
  let url: string | undefined;
  const link = document.createElement('a');
  try {
    url = URL.createObjectURL(new Blob([buildApiDiagnosticReport(records.value)], {type:'application/json;charset=utf-8'}));
    link.href = url; link.download = 'digital-twin-diagnostics.json';
    document.body.appendChild(link); link.click();
    feedback.value = '已发起脱敏诊断下载。';
  }
  catch { feedback.value = '下载失败，请重试。'; }
  finally {
    link.remove();
    if (url) { const objectUrl = url; setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
  }
}
</script>

<template>
  <details class="api-diagnostics" @toggle="onToggle">
    <summary>问题排查</summary>
    <p>供管理员协助排查使用，不影响护理操作。</p>
    <slot />
    <p>仅记录本页公共请求层最近 60 次请求。更新列表不请求后台；刷新页面后记录清空。未知接口路径会隐藏。</p>
    <div class="api-diagnostics__actions">
      <button type="button" @click="refresh">更新诊断列表</button>
      <button type="button" :disabled="!records.length" @click="download">导出脱敏诊断</button>
    </div>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <p v-if="!records.length" role="status">暂无请求记录，请完成一次操作后更新列表。</p>
    <ul v-else>
      <li v-for="(record, index) in records" :key="index">
        <strong>{{ record.ok ? '成功' : record.kind ? API_FAILURE_INFO[record.kind].title : '失败' }}</strong>
        <code>{{ record.path }}</code>
        <small>{{ new Date(record.startedAt).toLocaleString('zh-CN', {hour12:false}) }} · {{ record.durationMs }} ms</small>
        <small>HTTP {{ record.status ?? '未收到响应' }}<template v-if="record.businessCode != null"> · 业务码 {{ record.businessCode }}</template></small>
      </li>
    </ul>
    <p>不导出账号、令牌、地址参数、请求或响应正文，也不采集患者资料。</p>
  </details>
</template>

<style scoped>
.api-diagnostics { --diag-text: #dceef8; --diag-line: #49758b; --diag-bg: #102735; color: var(--diag-text); border: 1px solid var(--diag-line); background: var(--diag-bg); border-radius: 8px; padding: 12px; margin-top: 12px; font-size: var(--sidebar-font-body, 16px); line-height: 1.7; min-width: 0; }
:global([data-theme='light'] .api-diagnostics) { --diag-text: #16435f; --diag-line: #b9d8e7; --diag-bg: #f1f9fc; }
summary { cursor: pointer; min-height: 32px; }
p { margin: 8px 0; overflow-wrap: anywhere; font-size: var(--sidebar-font-caption, 14px); }
.api-diagnostics__actions { display: flex; flex-wrap: wrap; gap: 8px; }
button { color: inherit; background: transparent; border: 1px solid var(--diag-line); border-radius: 6px; min-height: 44px; padding: 6px 10px; font: inherit; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px currentColor; }
ul { list-style: none; padding: 0; margin: 8px 0; max-height: 320px; overflow: auto; }
li { display: grid; gap: 4px; padding: 8px 0; border-bottom: 1px solid var(--diag-line); overflow-wrap: anywhere; }
code, small { font-size: var(--sidebar-font-caption, 14px); white-space: normal; }
</style>
