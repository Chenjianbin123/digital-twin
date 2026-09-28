<script setup lang="ts">
defineProps<{ name: 'overview' | 'tasks' | 'inspection' | 'call' | 'infusion' | 'other' }>();
</script>

<template>
  <span class="nurse-workspace-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="name === 'overview'">
        <rect class="nurse-workspace-icon__accent" x="3" y="3" width="7" height="7" rx="1.3" />
        <rect x="14" y="3" width="7" height="7" rx="1.3" />
        <rect x="3" y="14" width="7" height="7" rx="1.3" />
        <rect class="nurse-workspace-icon__accent" x="14" y="14" width="7" height="7" rx="1.3" />
      </template>
      <template v-else-if="name === 'tasks' || name === 'other'">
        <path d="M8 4H5v17h14V4h-3" />
        <rect class="nurse-workspace-icon__accent" x="8" y="2" width="8" height="5" rx="1" />
        <path d="M9 11h6m-6 4h6m-6 3h4" />
      </template>
      <template v-else-if="name === 'inspection'">
        <path class="nurse-workspace-icon__accent" d="m12 2 8 3v7c0 4-5 8-8 10-3-2-8-6-8-10V5Z" />
        <path d="m8 12 3 3 5-6" />
      </template>
      <template v-else-if="name === 'call'">
        <path class="nurse-workspace-icon__accent" d="m5 3 4 1 1 5-3 2a15 15 0 0 0 6 6l2-3 5 1 1 4c-1 5-8 2-12-2S2 6 5 3Z" />
        <path d="M14 3a7 7 0 0 1 7 7m-7-3a3 3 0 0 1 3 3" />
      </template>
      <template v-else>
        <path d="M9 2h6m-3 0v4M7 6h10v10a5 5 0 0 1-10 0ZM12 21v1M7 10h10" />
        <path class="nurse-workspace-icon__accent" d="M8 11h8v5a4 4 0 0 1-8 0Z" stroke="none" />
        <path d="M12 13v4m-2-2h4" />
      </template>
    </svg>
  </span>
</template>

<style scoped lang="scss">
.nurse-workspace-icon {
  --workspace-icon-ink: #9ae4ff;
  --workspace-icon-line: #40738d;
  --workspace-icon-surface: #153b53;
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex: 0 0 36px; box-sizing: border-box;
  border: 1px solid var(--workspace-icon-line); border-radius: 6px 2px 6px 2px;
  background: var(--workspace-icon-surface); pointer-events: none;
  &::after { content: ''; position: absolute; right: -1px; bottom: -1px; width: 7px; height: 7px; border-right: 1px solid var(--workspace-icon-ink); border-bottom: 1px solid var(--workspace-icon-ink); border-radius: 0 0 6px; }
  svg { width: 22px; height: 22px; flex-shrink: 0; color: var(--workspace-icon-ink) !important; }
  &__accent { fill: currentColor; fill-opacity: .12; }
}
:global(.digital-twin[data-theme='light'] .nurse-workspace-icon) {
  --workspace-icon-ink: #007dae;
  --workspace-icon-line: #8bc9e5;
  --workspace-icon-surface: #e6f6ff;
}
:global(.digital-twin .workspace-tabs button[aria-selected='true'] .nurse-workspace-icon) {
  border-color: var(--workspace-icon-ink);
  box-shadow: inset 0 0 0 2px var(--workspace-icon-surface);
}
@container nurse-panel (max-width: 440px) {
  .nurse-workspace-icon { width: 28px; height: 28px; flex-basis: 28px; }
  .nurse-workspace-icon svg { width: 18px; height: 18px; }
}
</style>
