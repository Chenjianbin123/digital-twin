<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import NurseWorkspaceIcon from './NurseWorkspaceIcon.vue';
import EventSyncActions from './EventSyncActions.vue';
import ApiDiagnostics from './ApiDiagnostics.vue';
import type { NurseStationViewModel } from '@/core/nurse-station-view-model';
import { buildNurseStatusPresentation } from '@/core/nurse-status-presentation';
import { pageCoverageLabel } from '@/core/swp-page-coverage';

const props = defineProps<{ viewModel: NurseStationViewModel; warnings?: string[]; enabled?: boolean; highLoad?: boolean; eventSyncSupported?: boolean }>();
const status = computed(() => buildNurseStatusPresentation(props.viewModel, props.warnings));
const expanded = ref(true);
const contentId = useId();
function timeLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '尚无更新记录';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <section class="nurse-status-console" :class="{ 'is-collapsed': !expanded }" aria-label="病区状态与提醒">
    <div class="nsc-toolbar">
      <h3 class="nsc-title">病区状态<span class="nsc-toolbar-line" aria-hidden="true" /></h3>
      <button class="nsc-collapse" type="button" :aria-expanded="expanded" :aria-controls="contentId" :aria-label="expanded ? '收起病区状态与提醒' : '展开病区状态与提醒'" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
      </button>
    </div>
    <div class="nsc-event" :data-level="viewModel.state.level" role="status">
      <span class="nsc-symbol" aria-hidden="true">
        <svg viewBox="0 0 48 52" fill="none" focusable="false">
          <defs>
            <linearGradient :id="`${contentId}-bezel`" x1="5" y1="3" x2="42" y2="49" gradientUnits="userSpaceOnUse">
              <stop stop-color="var(--nsc-metal-light)" /><stop offset=".45" stop-color="var(--nsc-metal-mid)" /><stop offset="1" stop-color="var(--nsc-metal-dark)" />
            </linearGradient>
            <linearGradient :id="`${contentId}-core`" x1="12" y1="9" x2="36" y2="43" gradientUnits="userSpaceOnUse">
              <stop stop-color="var(--nsc-top)" /><stop offset="1" stop-color="var(--nsc-inset)" />
            </linearGradient>
          </defs>
          <path d="M13 3h22l10 10v26L35 49H13L3 39V13Z" :fill="`url(#${contentId}-bezel)`" stroke="var(--nsc-metal-mid)" />
          <path d="M14 7h20l7 8v22l-7 8H14l-7-8V15Z" :fill="`url(#${contentId}-core)`" stroke="var(--nsc-metal-dark)" />
          <path d="m4 14 9-10h22M8 16l6-8h20" stroke="var(--nsc-metal-light)" stroke-linecap="round" />
          <circle cx="24" cy="26" r="13" stroke="var(--nsc-symbol-tone)" opacity=".22" />
          <path d="M13 18a13 13 0 0 1 8-5m14 21a13 13 0 0 1-8 5M3 22v8m42-8v8" stroke="var(--nsc-symbol-tone)" stroke-width="2" stroke-linecap="round" />
          <path v-if="viewModel.state.level === 'normal'" class="nsc-symbol-glyph" d="m17 26 5 5 9-10" />
          <path v-else class="nsc-symbol-glyph" d="M24 18v10m0 6v.1" />
          <path d="M19 46h10" stroke="var(--nsc-symbol-tone)" stroke-linecap="round" opacity=".7" />
        </svg>
      </span>
      <div><strong>{{ status.eventLabel }}</strong>
        <p>{{ viewModel.state.message }}</p><small v-if="highLoad">床位高负载</small>
      </div>
    </div>
    <div v-if="!expanded" class="nsc-compact-status" role="status">
      <span class="nsc-status-chip" :data-status="viewModel.realtime.status"><NurseWorkspaceIcon name="overview" />信息：{{ viewModel.realtime.label }}</span>
    </div>
    <div :id="contentId" v-show="expanded" class="nsc-body">
    <details class="nsc-disclosure">
      <summary><span class="nsc-heading"><NurseWorkspaceIcon name="overview" /><span><span class="nsc-caption">信息更新</span><strong>{{ viewModel.realtime.label }}</strong></span></span><span class="nsc-action">查看详情</span></summary>
      <div class="nsc-details">
        <p class="nsc-note">信息未更新时请结合现场情况核对。</p>
        <ul class="nsc-sources">
          <li v-for="source in status.sources" :key="source.key" :data-status="source.status">
            <div><strong>{{ source.label }}</strong><span class="nsc-badge">{{ source.statusLabel }}</span></div>
            <small>最近更新：{{ timeLabel(source.syncedAt) }}</small>
            <p v-if="source.notice">{{ source.notice }}</p>
            <EventSyncActions v-if="source.key === 'events'" :key="viewModel.areaId ?? 'no-area'" :area-id="viewModel.areaId" :supported="Boolean(eventSyncSupported)" :sync="viewModel.swpEventSync" :retained-count="viewModel.swpEvents.filter(event => event.retained).length" />
          </li>
        </ul>
      </div>
    </details>
    <ApiDiagnostics>
      <ul class="nsc-sources">
        <li v-for="source in status.sources" :key="source.key">
          <strong>{{ source.label }}</strong>
          <p v-for="page in source.coverage" :key="page.label">{{ pageCoverageLabel(page.label, page) }}</p>
          <p v-for="reason in source.reasons" :key="reason">{{ reason }}</p>
        </li>
      </ul>
    </ApiDiagnostics>
    </div>
  </section>
</template>

<style scoped lang="scss" src="../../styles/nurse-status-console.scss"></style>

<style lang="scss">
// Keep this isolated control independent of legacy blanket sidebar color overrides.
.digital-twin[data-theme] .nurse-panel.nurse-workspace .nurse-status-console {
  strong, .nsc-title { color: var(--nsc-text) !important; }
  p, small, .nsc-caption { color: var(--nsc-muted) !important; }
  button, .nsc-action { color: var(--nsc-accent) !important; }
  .nsc-badge { color: var(--nsc-accent) !important; }
  [data-status='warning'] .nsc-badge, [data-status='stale'] .nsc-badge { color: var(--nsc-warn) !important; }
  [data-status='error'] .nsc-badge { color: var(--nsc-alert) !important; }
  button { background: var(--nsc-top) !important; border-color: var(--nsc-line) !important; }
  button:hover:not(:disabled) { background: color-mix(in srgb, var(--nsc-accent) 12%, var(--nsc-top)) !important; border-color: var(--nsc-accent) !important; }
  button.nsc-collapse { background: var(--nsc-tint) !important; box-shadow: inset 0 1px 0 var(--nsc-shine); }
  .nsc-status-chip { color: var(--nsc-accent) !important; }
  .nsc-status-chip[data-status='warning'], .nsc-status-chip[data-status='stale'] { color: var(--nsc-warn) !important; }
  .nsc-status-chip[data-status='error'] { color: var(--nsc-alert) !important; }
  .nsc-status-chip.is-muted { color: var(--nsc-muted) !important; }
}
.digital-twin[data-theme='light'] .nurse-panel .nurse-status-console {
  --nsc-bg: #eaf4fc; --nsc-top: #fff; --nsc-inset: #f7fbff; --nsc-line: #b7d5e7;
  --nsc-text: #163b59; --nsc-muted: #47627a; --nsc-accent: #006b9b; --nsc-alert: #b32643;
  --nsc-grid: #246c9a08; --nsc-tint: #2087c408; --nsc-warn: #835100; --nsc-warn-bg: #e8ad3610;
  --nsc-metal-light: #fff; --nsc-metal-mid: #bad1df; --nsc-metal-dark: #7798b1;
  --nsc-shine: #fff; --nsc-shadow: #234e7624; --nsc-soft-shadow: #234e7614;
}
</style>
