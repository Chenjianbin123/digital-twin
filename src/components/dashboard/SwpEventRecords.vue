<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { fetchActiveSwpAlarms, fetchActiveSwpCalls } from '@/api/swp-events';
import { createEventRecordBrowser, type EventPageState } from '@/core/event-record-browser';
import { normalizeSwpEvents } from '@/core/swp-event-normalizer';
import type { NormalizedSwpEvent, SwpEventSyncState } from '@/types/swp-events';
import type { TwinAreaEntity } from '@/types/twin';

const props = defineProps<{ area: TwinAreaEntity; areaId?: number | null; sync: SwpEventSyncState }>();
const opened = ref(false);
const source = ref<'call' | 'alarm'>('call');
const retryPage = ref(1);
const state = ref<EventPageState<NormalizedSwpEvent>>({ records: [], page: 0, total: null, loading: false, hasNext: false, error: null, warning: null, syncedAt: null });
const available = computed(() => Number.isSafeInteger(props.areaId) && Number(props.areaId) > 0);
const browser = createEventRecordBrowser<NormalizedSwpEvent>(async page => {
  if (!available.value) throw new Error('当前病区未就绪');
  const areaId = props.areaId!;
  const area = props.area;
  const kind = source.value;
  const result = await (kind === 'call' ? fetchActiveSwpCalls(areaId, page) : fetchActiveSwpAlarms(areaId, page));
  return { ...result, records: normalizeSwpEvents({ area, areaId, calls: kind === 'call' ? result.records : [], alarms: kind === 'alarm' ? result.records : [] }) };
}, next => { state.value = next; });

function load(page: number) {
  if (state.value.loading) return;
  retryPage.value = page;
  void browser.go(page);
}
watch([() => props.areaId, () => props.area, source, opened], () => {
  browser.reset();
  if (opened.value && available.value) load(1);
}, { flush: 'sync' });
onBeforeUnmount(browser.reset);
</script>

<template>
  <section class="event-records" aria-label="待处理记录查询">
    <h3>更多待处理记录</h3>
    <p>上方仅显示当前列表，可在此查看更多记录。查看记录不会改变处理结果。</p>
    <p v-if="sync.coverage?.some(item => !item.complete)" role="status">当前列表不完整，请继续查询并核对现场情况。</p>
    <button type="button" :disabled="!available" :aria-expanded="opened" @click="opened = !opened">{{ opened ? '收起记录查询' : '查看更多记录' }}</button>
    <template v-if="opened">
      <label class="event-records__source">记录类型
        <select v-model="source"><option value="call">呼叫记录（含体征预警）</option><option value="alarm">输液报警</option></select>
      </label>
      <p aria-live="polite">第 {{ state.page || 1 }} 页 · 本页 <strong>{{ state.records.length }}</strong> 条</p>
      <p class="event-records__note">更多记录请翻页查看；记录以查询时刻为准。</p>
      <small v-if="state.syncedAt">本页查询时间：{{ new Date(state.syncedAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</small>
      <p v-if="state.warning" role="status">记录有变化或尚不完整，请重新查询并核对现场情况。</p>
      <p v-if="state.error" role="alert">{{ state.page ? '记录暂未更新，当前显示上次查询结果。' : '暂未获取记录，请稍后重试。' }} <button type="button" :disabled="state.loading" @click="load(retryPage)">重试</button></p>
      <p v-if="state.loading" role="status">正在查询，已有结果保留供复核…</p>
      <ul class="event-records__list" :aria-busy="state.loading">
        <li v-for="item in state.records" :key="item.id">
          <div><strong>{{ item.title }}</strong><span>未处理</span></div>
          <p>{{ item.description }}</p>
          <small>{{ item.locationLabel }} · {{ item.startedAt || '时间未提供' }}</small>
        </li>
      </ul>
      <p v-if="state.page && !state.records.length && !state.loading">本页暂无可展示的未处理记录。</p>
      <nav class="event-records__actions" aria-label="事件分页">
        <button type="button" :disabled="state.loading || state.page <= 1" @click="load(state.page - 1)">上一页</button>
        <button type="button" :disabled="state.loading" @click="load(1)">刷新第一页</button>
        <button type="button" :disabled="state.loading || !state.hasNext" @click="load(state.page + 1)">下一页</button>
      </nav>
      <details v-if="state.error || state.warning" class="event-records__troubleshooting">
        <summary>问题排查</summary>
        <p>{{ state.error || state.warning }}</p>
        <p>查询总数：{{ state.total ?? '未知' }}；成功页码：{{ state.page }}</p>
      </details>
    </template>
  </section>
</template>

<style scoped>
.event-records { margin-top: 16px; padding: 16px; border: 1px solid var(--station-border, #49758b); border-radius: 12px; background: var(--station-surface, #102735); color: var(--workspace-ink, #dceef8); font-size: var(--sidebar-font-body, 16px); line-height: 1.7; }
h3 { margin: 0 0 8px; font-size: var(--sidebar-font-heading, 18px); }
p { margin: 8px 0; overflow-wrap: anywhere; }
button, select { min-height: 40px; padding: 6px 10px; border: 1px solid var(--station-border, #49758b); border-radius: 6px; background: var(--station-surface, #102735); color: inherit; font: inherit; }
button:not(:disabled):hover { box-shadow: inset 0 0 0 1px currentColor; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, select:focus-visible { outline: 2px solid #00a9db; outline-offset: 3px; }
.event-records__source { display: grid; gap: 6px; margin-top: 12px; }
select { width: 100%; min-width: 0; }
.event-records__list { list-style: none; padding: 0; margin: 12px 0; max-height: 440px; overflow-y: auto; }
.event-records__list li { padding: 12px 0; border-bottom: 1px solid var(--station-border, #49758b); }
.event-records__list li > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
.event-records__list span, small, .event-records__note { font-size: var(--sidebar-font-caption, 14px); }
.event-records__actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
