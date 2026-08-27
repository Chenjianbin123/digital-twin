<script setup lang="ts">
import type { EnvAlertResult } from '@/core/env-alert';

defineProps<{
  alert: EnvAlertResult;
}>();
</script>

<template>
  <div
    v-if="alert.level !== 'normal'"
    class="env-alert-banner"
    :class="`env-alert-banner--${alert.level}`"
  >
    <span class="env-alert-banner__icon">⚠</span>
    <span class="env-alert-banner__text">{{ alert.summary }}</span>
  </div>
</template>

<style scoped lang="scss">
.env-alert-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 20px 8px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;

  &--warning {
    background: rgba(255, 152, 0, 0.15);
    border: 1px solid rgba(255, 152, 0, 0.4);
    color: #ffb74d;
  }

  &--danger {
    background: rgba(255, 23, 68, 0.15);
    border: 1px solid rgba(255, 23, 68, 0.4);
    color: #ff8a80;
    animation: pulse 2s ease-in-out infinite;
  }

  &__icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  &__text {
    line-height: 1.4;
  }

  @include down($bp-sm) {
    margin: 0 10px 6px;
    padding: 6px 10px;
    font-size: 12px;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}
</style>
