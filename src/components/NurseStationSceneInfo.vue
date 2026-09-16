<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import type { NurseStationViewModel } from '@/core/nurse-station-view-model';
const props = defineProps<{ viewModel: NurseStationViewModel; theme?: 'light' | 'dark' }>();
const expanded = ref(true);
const contentId = useId();
watch(() => props.viewModel.area.areaCode, () => { expanded.value = true; });
const metrics = computed(() => {
  const vm = props.viewModel;
  const available = (key: string) => vm.dataFreshnessItems.some(item => item.key === key && (item.status === 'ready' || item.syncedAt));
  return [
    { label: '在床患者', value: available('ward') ? vm.metrics.occupied : '—', unit: '人' },
    { label: '患者呼叫', value: available('events') ? vm.metrics.calling : '—', unit: '项', alert: available('events') && vm.metrics.calling > 0 },
    { label: '在线设备', value: available('ward') ? vm.metrics.deviceOnline : '—', unit: '台' },
  ];
});
</script>

<template>
  <aside class="station-info" :data-theme="theme ?? 'dark'" aria-label="模型病区信息">
    <header>
      <div><span class="station-info__eyebrow">护士站 · 病区概况</span><h2>{{ viewModel.area.areaName }}</h2></div>
      <button type="button" :aria-expanded="expanded" :aria-controls="contentId" :aria-label="expanded ? '收起病区信息' : '展开病区信息'" @click="expanded = !expanded">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path :d="expanded ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" /></svg>
      </button>
    </header>
    <div v-show="expanded" :id="contentId">
      <dl><div v-for="metric in metrics" :key="metric.label"><dt>{{ metric.label }}</dt><dd :class="{ 'is-alert': metric.alert }">{{ metric.value }}<small>{{ metric.unit }}</small></dd></div></dl>
      <footer :class="{ 'is-warning': viewModel.realtime.status !== 'ready' }">
        <span>● {{ viewModel.realtime.label }}</span>
        <p v-if="viewModel.realtime.status !== 'ready'">{{ viewModel.realtime.detail }}；未获取项显示“—”，已有数值请核对。</p>
      </footer>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.station-info {
  --info-bg: #102735f2; --info-ink: #dceaf2; --info-muted: #a7bfcd; --info-line: #789bad38; --info-accent: #82e2d5;
  width: 340px; max-width: calc(100% - 32px); box-sizing: border-box; color: var(--info-ink); background: var(--info-bg); border: 1px solid var(--info-line); border-radius: 12px; box-shadow: 0 8px 28px #03131c20; backdrop-filter: blur(12px); pointer-events: auto;
  &[data-theme='light'] { --info-bg: #fafcf7f2; --info-ink: #2b4d42; --info-muted: #65796e; --info-line: #526f5529; --info-accent: #39755e; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; }
  header > div { min-width: 0; }
  &__eyebrow { color: var(--info-muted); font-size: 11px; letter-spacing: .04em; }
  h2 { margin: 5px 0 0; font-size: 17px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  button { display: grid; place-items: center; width: 32px; height: 32px; padding: 6px; border: 1px solid var(--info-line); border-radius: 7px; color: var(--info-muted); background: transparent; cursor: pointer; flex-shrink: 0; }
  button:hover { background: #82b0971a; }
  button:focus-visible { outline: 2px solid var(--info-accent); outline-offset: 3px; }
  button svg { width: 18px; height: 18px; }
  dl { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 0 16px 16px; }
  dl > div { padding: 0 10px; border-left: 1px solid var(--info-line); }
  dl > div:first-child { padding-left: 0; border: 0; }
  dt { color: var(--info-muted); font-size: 11px; }
  dd { margin: 8px 0 0; font-size: 27px; font-weight: 500; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  small { margin-left: 4px; font-size: 11px; font-weight: 400; color: var(--info-muted); }
  .is-alert { color: #eaa7b4; }
  &[data-theme='light'] .is-alert { color: #a44055; }
  footer { border-top: 1px solid var(--info-line); padding: 12px 16px; font-size: 11px; color: var(--info-accent); }
  footer.is-warning { color: #dfba7f; }
  &[data-theme='light'] footer.is-warning { color: #886020; }
  footer p { margin: 8px 0 0; line-height: 1.6; color: var(--info-muted); }
  @media(max-width:600px) { header { padding: 12px; } h2 { font-size: 15px; } dd { font-size: 23px; } }
}
</style>
