<script setup lang="ts">
defineProps<{
  minimal?: boolean;
}>();
</script>

<template>
  <div class="dash-frame" :class="{ 'dash-frame--minimal': minimal }" aria-hidden="true">
    <template v-if="!minimal">
      <span class="dash-frame__corner dash-frame__corner--tl" />
      <span class="dash-frame__corner dash-frame__corner--tr" />
      <span class="dash-frame__corner dash-frame__corner--bl" />
      <span class="dash-frame__corner dash-frame__corner--br" />
      <span class="dash-frame__edge dash-frame__edge--top" />
      <span class="dash-frame__edge dash-frame__edge--left" />
      <span class="dash-frame__edge dash-frame__edge--right" />
    </template>
  </div>
</template>

<style scoped lang="scss">
$panel-offset: calc(var(--scene-panel-width, 460px) + 12px);

.dash-frame {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;

  &--minimal {
    display: none;
  }

  &__corner {
    position: absolute;
    width: 28px;
    height: 28px;
    border-color: rgba(77, 208, 255, 0.55);
    border-style: solid;

    &--tl {
      top: 58px;
      left: 12px;
      border-width: 2px 0 0 2px;
    }

    &--tr {
      top: 58px;
      right: $panel-offset;
      border-width: 2px 2px 0 0;

      @include down($bp-md) {
        right: 12px;
      }
    }

    &--bl {
      bottom: 72px;
      left: 12px;
      border-width: 0 0 2px 2px;
    }

    &--br {
      bottom: 72px;
      right: $panel-offset;
      border-width: 0 2px 2px 0;

      @include down($bp-md) {
        right: 12px;
      }
    }
  }

  &__edge {
    position: absolute;
    background: linear-gradient(90deg, transparent, rgba(77, 208, 255, 0.25), transparent);
    opacity: 0.6;

    &--top {
      top: 58px;
      left: 48px;
      right: calc(var(--scene-panel-width, 460px) + 40px);
      height: 1px;

      @include down($bp-md) {
        right: 48px;
      }
    }

    &--left {
      top: 88px;
      bottom: 88px;
      left: 12px;
      width: 1px;
      background: linear-gradient(180deg, transparent, rgba(77, 208, 255, 0.25), transparent);
    }

    &--right {
      top: 88px;
      bottom: 88px;
      right: $panel-offset;
      width: 1px;
      background: linear-gradient(180deg, transparent, rgba(77, 208, 255, 0.25), transparent);

      @include down($bp-md) {
        right: 12px;
      }
    }
  }
}
</style>
