<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ value?: string }>();
// Keep the source's displayed clock time, consistent with the existing event metadata.
const parts = computed(() => props.value?.match(/^(?:\d{4}-)?(\d{2}-\d{2})[ T](\d{2}:\d{2})/));
</script>

<template>
  <div class="task-timeline-time" :aria-label="value || '时间待同步'">
    <template v-if="parts"><span class="task-timeline-time__date">{{ parts[1] }}</span><strong class="task-timeline-time__clock">{{ parts[2] }}</strong></template>
    <span v-else class="task-timeline-time__fallback">{{ value || '时间待同步' }}</span>
  </div>
</template>

<style scoped>
.task-timeline-time { display: none; }
</style>
