<script setup lang="ts">
import NurseCommandFrame from './NurseCommandFrame.vue';
import type { KeyMetric } from '@/core/workspace-metrics';

defineProps<{
  title: string;
  subtitle: string;
  kind: 'corridor' | 'room';
  metrics: KeyMetric[];
}>();
</script>

<template>
  <div class="ward-command-workspace" :class="`ward-command-workspace--${kind}`">
    <NurseCommandFrame />
    <header class="ward-command-hero">
      <div class="ward-command-eyebrow"><span>01 / 工作台</span><i aria-hidden="true" /></div>
      <div class="ward-command-identity">
        <svg class="ward-command-mark" viewBox="0 0 56 64" fill="none" aria-hidden="true">
          <path d="M28 2 53 16v32L28 62 3 48V16Z" fill="#e6f7ff" stroke="#009bd2" stroke-width="2" />
          <path d="M28 8 47 19v26L28 56 9 45V19Z" fill="#087db2" />
          <path v-if="kind === 'corridor'" d="M21 44V22h14v22M17 44h22M25 27h6m-6 5h6m-5 12v-7h4v7" stroke="white" stroke-width="2" />
          <path v-else d="M17 43V29m0 9h22v5m-22-9h22v4M21 28h6v6h-6m9 0v-6h7l2 6" stroke="white" stroke-width="2" />
        </svg>
        <div>
          <small>{{ kind === 'corridor' ? 'WARD CORRIDOR' : 'PATIENT CARE' }}</small>
          <h2>{{ title }}</h2>
        </div>
      </div>
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
