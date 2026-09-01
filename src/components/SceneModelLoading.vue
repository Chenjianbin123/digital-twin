<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="scene-model-loading" role="status" aria-live="polite">
    <span class="scene-model-loading__spinner" aria-hidden="true" />
    <strong>{{ title }}</strong>
    <small>{{ subtitle }}</small>
  </div>
</template>

<style scoped lang="scss">
.scene-model-loading {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  background: radial-gradient(circle at 50% 42%, rgba(15, 77, 91, 0.32), rgba(3, 14, 24, 0.92) 62%);
  color: rgba(220, 250, 250, 0.94);
  text-align: center;
  pointer-events: none;

  strong {
    font-size: 13px;
    letter-spacing: 0.04em;
  }

  small {
    color: rgba(180, 220, 224, 0.7);
    font-size: 10px;
  }

  &__spinner {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(157, 245, 235, 0.22);
    border-top-color: #9df5eb;
    border-radius: 50%;
    animation: scene-model-spin 0.85s linear infinite;
  }
}

@keyframes scene-model-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
