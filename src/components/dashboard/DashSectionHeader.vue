<script setup lang="ts">
defineProps<{
  title: string;
  count?: number | string;
}>();
</script>

<template>
  <header class="dash-head">
    <span class="dash-head__mark" aria-hidden="true" />
    <h2 class="dash-head__title">{{ title }}</h2>
    <span v-if="count != null" class="dash-head__count">{{ count }}</span>
    <span class="dash-head__line" aria-hidden="true" />
  </header>
</template>

<style scoped lang="scss">
.dash-head {
  @include dash-section-head;

  &__mark {
    @include dash-section-mark;
  }

  &__title {
    @include dash-section-title;
  }

  &__count {
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #4deaff;
    background: rgba(0, 120, 200, 0.22);
    border: 1px solid rgba(77, 208, 255, 0.38);
    border-radius: 999px;
  }

  &__line {
    @include dash-section-line;
  }
}
</style>
