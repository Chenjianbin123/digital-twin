<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveFileUrl } from '@/utils/file-url';

const DEFAULT_DOCTOR_AVATAR = '/images/staff-default-doctor.png';
const DEFAULT_NURSE_AVATAR = '/images/staff-default-nurse.png';

const props = withDefaults(defineProps<{
  pic?: string;
  name: string;
  size?: 'lg' | 'md' | 'sm';
  role?: 'doctor' | 'director' | 'nurse' | 'default';
  placeholderLabel?: string;
}>(), {
  size: 'md',
  role: 'default',
  placeholderLabel: '',
});

const primaryLoadFailed = ref(false);
const defaultLoadFailed = ref(false);

function isTemplateOrIconImage(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized)
    return false;
  return [
    '/swp_upload/picture/template/',
    '/template/',
    '/doorbtn/',
    '/bedbtn/',
    '/img/sip.',
    '/img/network.',
    'monitor.',
    'beddevice',
    'statusbar',
    'qrcode',
    'button',
    'menu-inactive',
  ].some(token => normalized.includes(token));
}

const safePrimarySrc = computed(() => {
  const pic = props.pic?.trim() ?? '';
  if (!pic || isTemplateOrIconImage(pic))
    return '';
  return pic;
});

const src = computed(() => resolveFileUrl(safePrimarySrc.value));

const defaultAvatarSrc = computed(() => {
  const role = props.role;
  if (role === 'doctor' || role === 'director')
    return DEFAULT_DOCTOR_AVATAR;
  if (role === 'nurse')
    return DEFAULT_NURSE_AVATAR;
  return '';
});

const activeSrc = computed(() => {
  if (src.value && !primaryLoadFailed.value)
    return src.value;
  if (defaultAvatarSrc.value && !defaultLoadFailed.value)
    return defaultAvatarSrc.value;
  return '';
});

watch(() => props.pic, () => {
  primaryLoadFailed.value = false;
  defaultLoadFailed.value = false;
});

watch(() => props.role, () => {
  defaultLoadFailed.value = false;
});

function handleImageError() {
  if (activeSrc.value === src.value)
    primaryLoadFailed.value = true;
  else
    defaultLoadFailed.value = true;
}

const placeholderText = computed(() => props.placeholderLabel || props.name.charAt(0));
</script>

<template>
  <img
    v-if="activeSrc"
    class="staff-avatar"
    :class="[
      `staff-avatar--${size}`,
      role !== 'default' ? `staff-avatar--${role}` : '',
    ]"
    :src="activeSrc"
    :alt="name"
    loading="lazy"
    referrerpolicy="no-referrer"
    @error="handleImageError"
  >
  <div
    v-else
    class="staff-avatar staff-avatar--placeholder"
    :class="[`staff-avatar--${size}`, `staff-avatar--${role}`]"
  >
    {{ placeholderText }}
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

  &--doctor {
    border-color: rgba(72, 213, 255, 0.78);
    box-shadow:
      0 0 0 2px rgba(72, 213, 255, 0.24),
      0 4px 18px rgba(1, 145, 210, 0.38),
      inset 0 0 14px rgba(180, 246, 255, 0.18);
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

    &.staff-avatar--doctor {
      background:
        radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.42), transparent 18%),
        linear-gradient(135deg, #48d5ff, #0277bd 58%, #06456f);
    }

    &.staff-avatar--nurse {
      background:
        radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.38), transparent 18%),
        linear-gradient(135deg, #ff94c2, #d82b73 58%, #7b1b58);
    }
  }
}
</style>
