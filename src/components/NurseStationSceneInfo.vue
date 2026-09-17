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
    { key: 'ward', label: '在床患者', value: available('ward') ? vm.metrics.occupied : '-', unit: '人' },
    { key: 'events', label: '患者呼叫', value: available('events') ? vm.metrics.calling : '-', unit: '项', alert: available('events') && vm.metrics.calling > 0 },
    { key: 'devices', label: '在线设备', value: available('ward') ? vm.metrics.deviceOnline : '-', unit: '台' },
  ];
});
</script>

<template>
  <aside class="station-info" :data-theme="theme ?? 'dark'" aria-label="模型病区信息">
    <header>
      <div><span class="station-info__eyebrow">护士站 · 病区概况</span><h2>{{ viewModel.area.areaName }}</h2></div>
      <div class="station-info__tools">
        <span
          class="station-info__sync"
          :class="{ 'is-warning': viewModel.realtime.status !== 'ready' }"
          role="status"
        >
          <i aria-hidden="true" />{{ viewModel.realtime.label }}
        </span>
        <button type="button" :aria-expanded="expanded" :aria-controls="contentId" :aria-label="expanded ? '收起病区信息' : '展开病区信息'" @click="expanded = !expanded">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path :d="expanded ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" /></svg>
        </button>
      </div>
    </header>
    <div v-show="expanded" :id="contentId">
      <dl>
        <div
          v-for="metric in metrics"
          :key="metric.key"
          :class="{
            'is-attention': metric.alert,
            'is-unverified': metric.key === 'events' && viewModel.realtime.status !== 'ready',
          }"
        >
          <dt>{{ metric.label }}</dt>
          <dd :class="{ 'is-alert': metric.alert }">{{ metric.value }}<small>{{ metric.unit }}</small></dd>
        </div>
      </dl>
      <footer v-if="viewModel.realtime.status !== 'ready'" class="is-warning">
        <p>{{ viewModel.realtime.detail }}；未获取项显示“-”，已有数值请核对。</p>
      </footer>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.station-info {
  --info-bg: linear-gradient(145deg, rgba(10, 39, 54, 0.62), rgba(7, 27, 41, 0.54));
  --info-ink: #e6f2f7;
  --info-muted: #9db8c4;
  --info-line: rgba(126, 202, 216, 0.2);
  --info-accent: #8fd9e4;
  --info-alert: #ff6b7d;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 360px;
  max-width: calc(100% - 32px);
  box-sizing: border-box;
  color: var(--info-ink);
  background: var(--info-bg);
  border: 1px solid var(--info-line);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(180, 236, 245, 0.1),
    0 0 0 1px rgba(118, 216, 226, 0.06),
    0 10px 20px rgba(0, 12, 22, 0.28),
    0 24px 52px rgba(0, 8, 18, 0.4);
  backdrop-filter: blur(24px) saturate(112%) brightness(1.03);
  -webkit-backdrop-filter: blur(24px) saturate(112%) brightness(1.03);
  pointer-events: auto;
  animation: station-info-border-breathe 3.6s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 8% 0%, rgba(126, 202, 216, 0.16), transparent 42%),
      linear-gradient(90deg, transparent 23px, rgba(126, 202, 216, 0.045) 24px);
    background-size: auto, 24px 100%;
    mask-image: linear-gradient(90deg, #0b1418 0%, #0b1418 55%, transparent 100%);
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -40%;
    z-index: 2;
    width: 40%;
    height: 2px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(150, 244, 245, 0.98), transparent);
    box-shadow: 0 0 14px rgba(122, 225, 231, 0.72);
    animation: station-info-border-scan 3.6s ease-in-out infinite;
  }

  > * { position: relative; z-index: 1; }

  &[data-theme='light'] {
    --info-bg: linear-gradient(145deg, rgba(247, 252, 253, 0.76), rgba(234, 244, 248, 0.7));
    --info-ink: #233e49;
    --info-muted: #5b7786;
    --info-line: #c5dce6;
    --info-accent: #348799;
    --info-alert: #b43c57;
    box-shadow: inset 0 1px 0 #f7fbfd, 0 10px 24px rgba(35, 68, 84, 0.08);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 14px 12px;
  }

  header > div { min-width: 0; }

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--info-accent);
    font-family: "Bahnschrift", "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: .16em;
    text-transform: uppercase;
    &::before {
      content: '';
      width: 18px;
      height: 2px;
      border-radius: 1px;
      background: currentColor;
      box-shadow: 22px 0 0 rgba(126, 202, 216, 0.28);
    }
  }

  &__tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__sync {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 26px;
    padding: 3px 8px;
    border: 1px solid rgba(121, 211, 186, 0.28);
    border-radius: 6px;
    color: #a9e8d4;
    background: rgba(60, 149, 123, 0.11);
    font-size: 12px;
    white-space: nowrap;

    i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    &.is-warning {
      color: #e5c783;
      border-color: rgba(229, 199, 131, 0.34);
      background: rgba(183, 137, 54, 0.12);
    }
  }

  h2 {
    margin: 7px 0 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-shadow: 0 0 16px rgba(126, 202, 216, 0.16);
  }

  button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 10px;
    border: 1px solid var(--info-line);
    border-radius: 7px;
    color: var(--info-muted);
    background: rgba(12, 36, 48, 0.45);
    box-shadow: inset 0 1px 0 rgba(180, 236, 245, 0.08);
    cursor: pointer;
    flex-shrink: 0;
  }

  button:hover {
    color: var(--info-ink);
    border-color: rgba(143, 217, 228, 0.55);
    background: rgba(28, 72, 88, 0.55);
  }

  button:focus-visible {
    outline: 2px solid var(--info-accent);
    outline-offset: 2px;
  }

  button svg { width: 18px; height: 18px; }

  &[data-theme='light'] button {
    background: #edf5f8;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin: 0 12px 12px;
    padding: 4px;
    border: 0;
    border-radius: 8px;
    background: rgba(5, 24, 36, 0.52);
    box-shadow:
      inset 0 1px 0 rgba(159, 226, 233, 0.06),
      inset 12px 0 24px -24px rgba(119, 223, 230, 0.5);
    box-shadow: inset 0 1px 0 rgba(180, 236, 245, 0.06);
  }

  &[data-theme='light'] dl {
    background: #edf5f8;
    border-color: #c5dce6;
  }

  dl > div {
    position: relative;
    padding: 10px 9px 11px;
    border: 0;
    border-radius: 6px;
  }

  dl > div + div::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 1px;
    background: rgba(126, 202, 216, 0.18);
  }

  dt {
    color: var(--info-muted);
    font-size: 12px;
    letter-spacing: .02em;
  }

  dd {
    margin: 8px 0 0;
    font-family: "Bahnschrift", "Segoe UI", sans-serif;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  small {
    margin-left: 4px;
    font-size: 12px;
    font-weight: 400;
    color: var(--info-muted);
  }

  .is-alert {
    color: var(--info-alert);
    text-shadow: 0 0 14px rgba(255, 91, 108, 0.35);
  }

  dl > div.is-attention {
    background: rgba(148, 48, 63, 0.16);
  }

  dl > div.is-unverified::after {
    content: '';
    position: absolute;
    right: 8px;
    top: 8px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #e5c783;
  }

  &[data-theme='light'] dl > div.is-attention {
    background: #f9eef1;
    box-shadow: inset 0 0 0 1px #e7c0c8;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--info-line);
    padding: 9px 14px 11px;
    font-size: 12px;
    color: var(--info-accent);
  }

  footer.is-warning {
    color: #dfba7f;
  }

  &[data-theme='light'] footer.is-warning { color: #886020; }

  footer p {
    flex-basis: 100%;
    margin: 0;
    line-height: 1.6;
    color: var(--info-muted);
  }

  @media (max-width: 600px) {
    header { padding: 12px; }
    h2 { font-size: 15px; }
    dd { font-size: 23px; }
    dl { margin: 0 10px 10px; }
    &__sync { display: none; }
  }

  @media (prefers-reduced-transparency: reduce) {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(10, 28, 38, 0.94);
  }
}

@keyframes station-info-border-breathe {
  0%, 100% {
    border-color: rgba(126, 202, 216, 0.2);
  }
  50% {
    border-color: rgba(137, 232, 234, 0.62);
  }
}

@keyframes station-info-border-scan {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  18%, 82% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(395px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .station-info {
    animation: none;

    &::after {
      left: 18px;
      right: 18px;
      width: auto;
      opacity: 1;
      transform: none;
      animation: none;
    }
  }
}
</style>
