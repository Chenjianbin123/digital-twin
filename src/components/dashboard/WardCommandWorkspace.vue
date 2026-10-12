<script setup lang="ts">
import NurseCommandFrame from './NurseCommandFrame.vue';
import GlassWorkspaceTitle from './GlassWorkspaceTitle.vue';
import type { KeyMetric } from '@/core/workspace-metrics';

defineProps<{
  title: string;
  subtitle: string;
  kind: 'corridor' | 'room';
  metrics: KeyMetric[];
}>();
</script>

<template>
  <div class="ward-command-workspace ward-clinical" :class="`ward-command-workspace--${kind}`">
    <NurseCommandFrame />
    <GlassWorkspaceTitle :title="title" :kicker="kind === 'corridor' ? 'WARD CORRIDOR' : 'PATIENT CARE'" />
    <header class="ward-command-hero">
      <p class="ward-command-context">{{ subtitle }}</p>
      <dl class="ward-command-metrics">
        <div v-for="metric in metrics" :key="metric.key">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}<small v-if="metric.unit">{{ metric.unit }}</small></dd>
        </div>
      </dl>
    </header>
    <div class="ward-command-content"><slot /></div>
  </div>
</template>

<style scoped>
/* In dark mode the existing sidebar retains its original layout. */
.ward-command-workspace, .ward-command-content { display: contents; }
.ward-command-hero { display: none; }
</style>
