<script setup lang="ts">
defineProps<{ name: 'hospital' | 'layers' | 'search' | 'arrow' | 'check' | 'pin' | 'history' }>();
</script>

<template>
  <svg class="area-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'hospital'">
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M9 21v-5h6v5M10 7h4M12 5v4M8 12h1M15 12h1" />
    </template>
    <template v-else-if="name === 'layers'">
      <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
    </template>
    <path v-else-if="name === 'arrow'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <template v-else-if="name === 'pin'">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" />
    </template>
  </svg>
</template>

<style scoped>
.area-icon { display: block; width: 1em; height: 1em; flex-shrink: 0; }
</style>
