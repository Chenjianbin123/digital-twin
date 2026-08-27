<script setup lang="ts">
import { computed } from 'vue';
import type { HospitalInfo } from '@/types/hospital';
import { htmlToPlainText } from '@/utils/html-text';
import { resolveFileUrl } from '@/utils/file-url';

export interface KeyMetric {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
}

const props = defineProps<{
  info: HospitalInfo | null;
  loading?: boolean;
  keyMetrics?: KeyMetric[];
}>();

const introText = computed(() => htmlToPlainText(props.info?.hospitalNote));

const logoUrl = computed(() => resolveFileUrl(props.info?.hospitalLogoPic));

const visibleMetrics = computed(() =>
  (props.keyMetrics ?? []).filter(m => m.value != null && m.value !== '' && m.value !== '—'),
);

const hasContent = computed(() =>
  props.loading
  || !!introText.value
  || visibleMetrics.value.length > 0
  || !!logoUrl.value
  || !!props.info?.hospitalName,
);
</script>

<template>
  <section v-if="hasContent" class="hospital-intro" aria-label="医院介绍">
    <header class="hospital-intro__head">
      <span class="hospital-intro__mark" aria-hidden="true" />
      <h2 class="hospital-intro__title">医院介绍</h2>
      <span class="hospital-intro__line" aria-hidden="true" />
    </header>

    <div v-if="loading" class="hospital-intro__loading">加载医院介绍...</div>

    <template v-else-if="info">
      <p v-if="introText" class="hospital-intro__note">{{ introText }}</p>

      <div v-if="visibleMetrics.length" class="hospital-intro__grid">
        <article v-for="item in visibleMetrics" :key="item.key" class="hospital-intro__metric">
          <span class="hospital-intro__metric-icon" :class="`hospital-intro__metric-icon--${item.key}`" aria-hidden="true" />
          <div class="hospital-intro__metric-body">
            <span class="hospital-intro__metric-label">{{ item.label }}</span>
            <span class="hospital-intro__metric-value">
              {{ item.value }}<small v-if="item.unit">{{ item.unit }}</small>
            </span>
          </div>
        </article>
      </div>

      <div v-if="logoUrl || info.hospitalName" class="hospital-intro__footer">
        <img
          v-if="logoUrl"
          class="hospital-intro__logo"
          :src="logoUrl"
          :alt="info.hospitalName || '医院 Logo'"
        >
        <span v-if="info.hospitalName" class="hospital-intro__name">{{ info.hospitalName }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.hospital-intro {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  margin: 0 0 2px;
  padding: 14px 18px 16px;
  color: #eef8ff;
  background: rgba(7, 22, 39, 0.2);
  -webkit-font-smoothing: antialiased;
  transform: translateZ(0);

  &__head {
    @include dash-section-head;
    margin-bottom: 10px;
  }

  &__mark {
    @include dash-section-mark;
    filter: none;
  }

  &__title {
    @include dash-section-title;
    text-shadow: none;
  }

  &__line {
    @include dash-section-line;
    box-shadow: none;
  }

  &__note {
    margin: 0 0 12px;
    max-height: 88px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.75;
    color: rgba(224, 241, 255, 0.9);
    text-align: justify;
    text-shadow: none;
    scrollbar-width: thin;
    scrollbar-color: rgba(77, 208, 255, 0.28) transparent;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb {
      background: rgba(77, 208, 255, 0.25);
      border-radius: 4px;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  &__metric {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 10px 12px;
    background: rgba(6, 22, 40, 0.4);
    border: 1px solid rgba(77, 208, 255, 0.18);
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  &__metric-icon {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(0, 116, 178, 0.22);
    border: 1px solid rgba(77, 208, 255, 0.26);
    position: relative;
    box-shadow: inset 0 0 14px rgba(77, 208, 255, 0.08);

    &::after {
      content: '';
      position: absolute;
      inset: 6px;
      border-radius: 3px;
      background: linear-gradient(135deg, #4deaff, #0099cc);
      opacity: 0.92;
    }

    &--bed::after { border-radius: 2px; height: 8px; top: 11px; inset-inline: 5px; }
    &--temp::after { border-radius: 50%; width: 8px; height: 8px; top: 6px; left: 10px; }
    &--rooms::after { clip-path: polygon(50% 10%, 90% 40%, 90% 85%, 10% 85%, 10% 40%); }
    &--device::after { inset: 7px 5px; border-radius: 2px; }
    &--patient::after { border-radius: 50%; width: 10px; height: 10px; top: 5px; left: 9px; box-shadow: 0 8px 0 -2px #00d4ff; }
    &--rate::after { clip-path: polygon(20% 80%, 45% 45%, 65% 60%, 85% 25%, 85% 80%); }
  }

  &__metric-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__metric-label {
    font-size: 10px;
    color: rgba(174, 204, 229, 0.82);
  }

  &__metric-value {
    font-size: 17px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #76e7ff;
    line-height: 1.1;
    text-shadow: none;

    small {
      margin-left: 2px;
      font-size: 11px;
      font-weight: 600;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(77, 208, 255, 0.12);
  }

  &__logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px;
  }

  &__name {
    font-size: 12px;
    font-weight: 600;
    color: rgba(190, 220, 245, 0.88);
  }

  &__loading {
    margin: 0;
    font-size: 12px;
    color: rgba(180, 210, 235, 0.75);
  }
}
</style>
