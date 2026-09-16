<script setup lang="ts">
import type { DashboardTheme } from '@/core/use-dashboard-theme';
defineProps<{ theme: DashboardTheme }>();
defineEmits<{ toggle: [] }>();
</script>
<template>
  <button class="entrance-theme-toggle" type="button" :data-theme="theme" :aria-label="theme === 'light' ? '切换深色模式' : '切换浅色模式'" @click="$emit('toggle')">
    <span aria-hidden="true">{{ theme === 'light' ? '◐' : '☀' }}</span>{{ theme === 'light' ? '深色模式' : '浅色模式' }}
  </button>
</template>
<style scoped>
.entrance-theme-toggle { position: relative; z-index: 3; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; flex-shrink: 0; padding: 6px 12px; border: 1px solid #507683; border-radius: 6px; background: #153443; color: #dcebf2; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.entrance-theme-toggle[data-theme='light'] { background: #f5fafc; color: #286c80; border-color: #b4cedb; }
.entrance-theme-toggle:hover { filter: brightness(.95); }
.entrance-theme-toggle:focus-visible { outline: 2px solid #2987a1; outline-offset: 3px; }
</style>
