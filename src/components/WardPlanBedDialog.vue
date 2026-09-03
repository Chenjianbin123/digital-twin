<script setup lang="ts">
import { computed } from 'vue';
import { resolveBedStatus } from '@/core/bed-status';
import { displayPatientName } from '@/utils/mask-patient';
import type { TwinBedEntity } from '@/types/twin';

const props = defineProps<{
  bed: TwinBedEntity;
}>();

const emit = defineEmits<{
  close: [];
}>();

const status = computed(() => resolveBedStatus(props.bed));
const sick = computed(() => props.bed.sickInfo);
const patientName = computed(() => displayPatientName(sick.value?.sickName, props.bed.isOccupied));
const isInfusing = computed(() => ['300', '301'].includes(props.bed.statusBarInfo?.status ?? ''));
const isInfusionDone = computed(() => ['302', '305'].includes(props.bed.statusBarInfo?.status ?? ''));
const basicRows = computed(() => {
  if (!sick.value)
    return [];
  return [
    ['性别年龄', [sick.value.sickSex, sick.value.sickAge ? `${sick.value.sickAge}岁` : ''].filter(Boolean).join(' / ') || '--'],
    ['住院号', sick.value.sickNo || '--'],
    ['入院时间', sick.value.sickInTime || '--'],
    ['护理等级', sick.value.nursingLevel || props.bed.nursingLevel || '--'],
    ['责任医生', sick.value.visitDoctorName || '--'],
    ['责任护士', sick.value.dutyNurseName || '--'],
    ['饮食', sick.value.sickDiet || '无'],
    ['过敏', sick.value.sickAllergy || '无'],
    ['隔离', sick.value.sickIsolation || '无'],
  ];
});
</script>

<template>
  <Teleport to="body">
    <div class="ward-plan-bed-dialog" role="dialog" aria-modal="true" @click.self="emit('close')">
      <section class="ward-plan-bed-dialog__card">
        <button class="ward-plan-bed-dialog__close" type="button" aria-label="关闭床位详情" @click="emit('close')">
          ×
        </button>

        <header class="ward-plan-bed-dialog__header">
          <div>
            <span class="ward-plan-bed-dialog__kicker">2.5D BED DETAIL</span>
            <h3>{{ bed.bedName }}</h3>
          </div>
          <span class="ward-plan-bed-dialog__status" :style="{ '--status-color': status.color }">
            {{ status.label }}
          </span>
        </header>

        <div v-if="sick" class="ward-plan-bed-dialog__patient">
          <strong>{{ patientName }}</strong>
          <span v-if="bed.nursingLevel" :style="{ color: bed.nursingColor || status.color }">
            {{ bed.nursingLevel }}
          </span>
        </div>
        <div v-else class="ward-plan-bed-dialog__empty">
          <strong>暂无患者信息</strong>
          <span>当前为空床，可点击其它床位查看详情</span>
        </div>

        <div v-if="bed.isCalling || isInfusing || isInfusionDone" class="ward-plan-bed-dialog__alert">
          <span v-if="bed.isCalling">呼叫中，请及时响应</span>
          <span v-else-if="isInfusing">输液巡视中</span>
          <span v-else>输液已完成，请确认处理</span>
        </div>

        <dl v-if="basicRows.length" class="ward-plan-bed-dialog__grid">
          <template v-for="[label, value] in basicRows" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>

        <p v-if="sick?.sickSafetyPrecautions" class="ward-plan-bed-dialog__note">
          安全防护：{{ sick.sickSafetyPrecautions }}
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.ward-plan-bed-dialog {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at 50% 45%, rgba(77, 208, 255, 0.18), transparent 34%),
    rgba(0, 8, 18, 0.48);
  backdrop-filter: blur(7px);
  pointer-events: auto;

  &__card {
    position: relative;
    width: min(560px, calc(100vw - 48px));
    padding: 24px;
    overflow: hidden;
    color: #effaff;
    border: 1px solid rgba(91, 219, 255, 0.36);
    border-radius: 22px;
    background:
      linear-gradient(135deg, rgba(12, 35, 58, 0.94), rgba(5, 17, 32, 0.9)),
      repeating-linear-gradient(90deg, rgba(91, 219, 255, 0.035) 0 1px, transparent 1px 42px);
    box-shadow:
      0 22px 80px rgba(0, 0, 0, 0.46),
      inset 0 0 34px rgba(77, 208, 255, 0.08);
    animation: ward-plan-dialog-in 0.28s ease both;
  }

  &__close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 34px;
    height: 34px;
    color: #bdefff;
    border: 1px solid rgba(91, 219, 255, 0.26);
    border-radius: 50%;
    background: rgba(11, 32, 52, 0.74);
    cursor: pointer;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    padding-right: 40px;

    h3 {
      margin: 4px 0 0;
      font-size: 34px;
      line-height: 1;
    }
  }

  &__kicker {
    color: rgba(91, 219, 255, 0.72);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  &__status {
    --status-color: #2fe6a6;
    padding: 8px 16px;
    color: var(--status-color);
    font-size: 18px;
    font-weight: 900;
    border: 1px solid color-mix(in srgb, var(--status-color), transparent 45%);
    border-radius: 999px;
    background: color-mix(in srgb, var(--status-color), transparent 86%);
    box-shadow: 0 0 22px color-mix(in srgb, var(--status-color), transparent 70%);
  }

  &__patient,
  &__empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 22px;
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.055);

    strong {
      font-size: 28px;
    }

    span {
      color: rgba(213, 235, 246, 0.72);
      font-weight: 800;
    }
  }

  &__alert {
    margin-top: 14px;
    padding: 12px 14px;
    color: #ffd7e4;
    font-size: 16px;
    font-weight: 800;
    border: 1px solid rgba(255, 77, 141, 0.32);
    border-radius: 14px;
    background: rgba(255, 77, 141, 0.12);
  }

  &__grid {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px 18px;
    margin: 20px 0 0;

    dt {
      color: rgba(169, 206, 224, 0.72);
      font-weight: 700;
    }

    dd {
      margin: 0;
      color: #f4fbff;
      font-weight: 800;
      word-break: break-word;
    }
  }

  &__note {
    margin: 18px 0 0;
    padding: 12px 14px;
    color: #ffe2b8;
    border-radius: 12px;
    background: rgba(255, 184, 77, 0.12);
  }
}

@keyframes ward-plan-dialog-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
