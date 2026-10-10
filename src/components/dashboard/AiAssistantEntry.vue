<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>
<template>
  <button type="button" class="ai-assistant-entry" :aria-expanded="open" aria-controls="ai-assistant-panel"
    aria-label="AI 助手" title="AI 助手" @click="emit('toggle')">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
    <span>AI 助手</span>
  </button>
</template>
<style scoped>
.ai-assistant-entry { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; height: 44px; padding: 0 12px; border: 1px solid var(--hdr-line); border-radius: 6px; background: var(--hdr-control); color: var(--hdr-ink); box-shadow: inset 0 1px 0 var(--hdr-highlight), 0 2px 3px var(--hdr-shadow); font: inherit; white-space: nowrap; cursor: pointer; }
.ai-assistant-entry svg { width: 20px; height: 20px; fill: none; stroke: var(--hdr-accent); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ai-assistant-entry:hover, .ai-assistant-entry[aria-expanded='true'] { background: var(--hdr-hover); border-color: var(--hdr-accent); color: var(--hdr-accent); }
.ai-assistant-entry:focus-visible { outline: 2px solid var(--hdr-accent); outline-offset: 3px; }
@media (min-width: 1100px) and (max-width: 1279px), (max-width: 400px) { .ai-assistant-entry span { display: none; } .ai-assistant-entry { width: 40px; padding: 0; } }
@media (max-width: 767px) { .ai-assistant-entry { height: 40px; padding: 0 8px; } }
</style>
