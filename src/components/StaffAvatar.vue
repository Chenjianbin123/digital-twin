<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveFileUrl } from '@/utils/file-url';

const props = withDefaults(defineProps<{
  pic?: string;
  name: string;
  size?: 'lg' | 'md' | 'sm';
  role?: 'director' | 'nurse' | 'default';
}>(), {
  size: 'md',
  role: 'default',
});

const loadFailed = ref(false);

const src = computed(() => resolveFileUrl(props.pic));

watch(() => props.pic, () => {
  loadFailed.value = false;
});

function onError() {
  loadFailed.value = true;
}
</script>

<template>
  <img
    v-if="src && !loadFailed"
    class="staff-avatar"
    :class="[
      `staff-avatar--${size}`,
      role !== 'default' ? `staff-avatar--${role}` : '',
    ]"
    :src="src"
    :alt="name"
    loading="lazy"
    referrerpolicy="no-referrer"
    @error="onError"
  >
  <div
    v-else
    class="staff-avatar staff-avatar--placeholder"
    :class="[`staff-avatar--${size}`, `staff-avatar--${role}`]"
  >
    {{ name.charAt(0) }}
  </div>
</template>

<style scoped lang="scss">
.staff-avatar {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32);

  &--lg {
    width: 60px;
    height: 60px;
  }

  &--md {
    width: 52px;
    height: 52px;
  }

  &--sm {
    width: 36px;
    height: 36px;
  }

  &--director {
    border-color: rgba(79, 195, 247, 0.75);
    box-shadow:
      0 0 0 2px rgba(79, 195, 247, 0.22),
      0 4px 16px rgba(2, 136, 209, 0.35);
  }

  &--nurse {
    border-color: rgba(244, 143, 177, 0.75);
    box-shadow:
      0 0 0 2px rgba(244, 143, 177, 0.22),
      0 4px 16px rgba(236, 64, 122, 0.35);
  }

  &--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #546e7a, #37474f);

    &.staff-avatar--lg {
      font-size: 24px;
    }

    &.staff-avatar--md {
      font-size: 20px;
    }

    &.staff-avatar--sm {
      font-size: 16px;
    }

    &.staff-avatar--director {
      background: linear-gradient(135deg, #29b6f6, #0277bd);
    }

    &.staff-avatar--nurse {
      background: linear-gradient(135deg, #f06292, #c2185b);
    }
  }
}
</style>
