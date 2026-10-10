<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label: string;
  controls: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [collapsed: boolean] }>();
</script>

<template>
  <button type="button" class="sidebar-section-toggle"
    :aria-label="`${modelValue ? '展开' : '收起'}${label}`"
    :aria-expanded="!modelValue" :aria-controls="controls"
    @click.stop="emit('update:modelValue', !modelValue)">
    <span class="sidebar-section-toggle__label">{{ modelValue ? '展开' : '收起' }}</span>
    <span class="sidebar-section-toggle__icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" :class="{ 'is-collapsed': modelValue }"><path d="m4 10 4-4 4 4" /></svg>
    </span>
  </button>
</template>

<style lang="scss">
// 保留内容节点与内部状态，只改变可见性；不卸载告警或中断数据订阅。
.sidebar-section-body { display: contents; }
.digital-twin[data-theme] .sidebar-section-toggle {
  --toggle-accent: var(--sidebar-accent, #73d4f4);
  --toggle-ink: var(--sidebar-muted, #a7c7db);
  --toggle-line: var(--sidebar-line, #426b81);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  flex-shrink: 0; min-height: 36px; padding: 4px 8px 4px 12px; margin-left: auto;
  border: 1px solid color-mix(in srgb, var(--toggle-line) 60%, transparent) !important; border-radius: 8px;
  background: color-mix(in srgb, var(--toggle-accent) 4%, transparent) !important;
  color: var(--toggle-ink) !important;
  font-family: var(--sidebar-font-family); font-size: var(--sidebar-font-caption, 14px) !important;
  font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer;
  box-shadow: none !important; text-shadow: none;
  transition: color .18s ease, background-color .18s ease, border-color .18s ease;
  &__label { color: inherit !important; font-size: inherit !important; font-weight: inherit; letter-spacing: .04em; }
  &__icon {
    display: grid; place-items: center; flex-shrink: 0; width: 20px; height: 20px; border-radius: 5px;
    color: var(--toggle-accent) !important;
    background: color-mix(in srgb, var(--toggle-accent) 9%, transparent);
  }
  svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; transition: transform .18s ease; }
  svg.is-collapsed { transform: rotate(180deg); }
  &[aria-expanded='false'] { color: var(--toggle-accent) !important; }
  &:hover, &:focus-visible {
    color: var(--toggle-accent) !important;
    border-color: color-mix(in srgb, var(--toggle-accent) 45%, transparent) !important;
    background: color-mix(in srgb, var(--toggle-accent) 10%, transparent) !important;
  }
  &:active { background: color-mix(in srgb, var(--toggle-accent) 16%, transparent) !important; }
  &:focus-visible { outline: 2px solid var(--toggle-accent); outline-offset: 3px; }
}
.digital-twin[data-theme='light'] .sidebar-section-toggle {
  --toggle-accent: var(--sidebar-accent, #087fae);
  --toggle-ink: var(--sidebar-muted, #536f80);
  --toggle-line: var(--sidebar-line, #b5d9ed);
}
.digital-twin[data-theme] .sidebar-section--collapsed > :is(.hospital-intro__head, .alert-task-panel__heading, .station-chart__heading, .ward-clinical-heading, .status-history__heading) {
  margin-bottom: 0 !important; padding-bottom: 0; border-bottom: 0;
}
.sidebar-section-actions { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.sidebar-section-summary { margin: 8px 0 0; font-size: var(--sidebar-font-caption); color: var(--sidebar-muted); }
@container ward-clinical (max-width: 420px) {
  .digital-twin[data-theme] .sidebar-section-toggle {
    gap: 4px; padding-inline: 8px;
    &__icon { width: 16px; height: 16px; border-radius: 4px; }
  }
}
@media (pointer: coarse) { .digital-twin[data-theme] .sidebar-section-toggle { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .digital-twin[data-theme] .sidebar-section-toggle, .digital-twin[data-theme] .sidebar-section-toggle svg { transition: none; } }
</style>
