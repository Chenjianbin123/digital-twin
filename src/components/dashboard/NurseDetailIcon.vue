<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
  beds: 'M3 5v15m18-9v9M3 16h18M3 9h6v7m0-5h9l3 3v2',
  devices: 'M3 4h18v13H3ZM8 21h8m-4-4v4M6 11h3l2-4 3 7 2-3h2',
  settings: 'm10 2-1 3-3 1-3-1-1 3 2 2v4l-2 2 1 3 3-1 3 1 1 3h4l1-3 3-1 3 1 1-3-2-2v-4l2-2-1-3-3 1-3-1-1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  activity: 'M4 13h3v8H4Zm6-6h3v14h-3Zm6-4h3v18h-3ZM3 9l7-6 4 1 6-3',
  environment: 'M3 21V9l9-6 9 6v12M8 21V11h8v10m-4-7v7',
  infusion: 'M9 2h6m-3 0v4M7 6h10v10a5 5 0 0 1-10 0ZM12 21v1M7 10h10',
  events: 'M6 9a6 6 0 0 1 12 0c0 6 3 6 3 9H3c0-3 3-3 3-9m4 13h4',
  call: 'm5 3 4 1 1 5-3 2a15 15 0 0 0 6 6l2-3 5 1 1 4c-1 5-8 2-12-2S2 6 5 3Z',
  temp: 'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Zm3-7v11m0 0h.01',
  humid: 'M12 2S4 11 4 16a8 8 0 0 0 16 0c0-5-8-14-8-14Zm-4 14a4 4 0 0 0 4 4',
  average: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  arrived: 'm7 12 3 3 7-7M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  unattended: 'M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4',
};
</script>

<template>
  <svg class="clinical-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'warning'">
      <path d="m12 3 10 18H2Z" fill="currentColor" />
      <path d="M12 9v5m0 3v.5" stroke="var(--clinical-surface, #fff)" stroke-width="2" />
    </template>
    <path v-else :d="paths[name] || paths.events" />
  </svg>
</template>
