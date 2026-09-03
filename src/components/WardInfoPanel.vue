<script setup lang="ts">

import { computed } from 'vue';

import { displayPatientName, maskSickName } from '@/utils/mask-patient';

import DoorStaffCards from '@/components/DoorStaffCards.vue';
import StatusHistory from '@/components/StatusHistory.vue';
import { resolveBedStatus } from '@/core/bed-status';
import { formatBedLabel, type AlertTask } from '@/core/alert-workflow';
import type { EnvAlertResult } from '@/core/env-alert';
import type { InspectionRoomSummary } from '@/types/inspection';
import { getWardBedStats, type BedStatusMeta, type StatusHistoryEntry, type TwinAreaEntity, type TwinBedEntity, type TwinWardEntity } from '@/types/twin';



const props = defineProps<{

  area: TwinAreaEntity | null;

  ward: TwinWardEntity | null;

  selectedBed: TwinBedEntity | null;

  selectedStatus: BedStatusMeta | null;

  envAlert: EnvAlertResult;

  statusHistory: StatusHistoryEntry[];

  activeAlertTask?: AlertTask | null;

  inspectionSummary?: InspectionRoomSummary | null;

}>();



const emit = defineEmits<{

  close: [];
  markAlertHandling: [taskId: string];
  resolveAlert: [taskId: string];

}>();



const bedStats = computed(() => props.ward ? getWardBedStats(props.ward) : null);

function staffText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function staffPicText(...values: unknown[]) {
  for (const value of values) {
    const text = staffText(value);
    if (text && !isTemplateOrIconImage(text))
      return text;
  }
  return '';
}

const managedCareSourceSick = computed(() => {
  const selectedSick = props.selectedBed?.sickInfo;
  if (selectedSick)
    return selectedSick;
  return props.ward?.beds.find(bed => bed.sickInfo)?.sickInfo ?? null;
});

const managedCareStaff = computed(() => {
  const sick = managedCareSourceSick.value;
  if (!sick)
    return [];

  const sickRecord = sick as Record<string, unknown>;
  const bedDoctorName = staffText(sick.visitDoctorName) || staffText(sick.bedDoctorName);
  const bedDoctorPic = staffPicText(
    sick.visitDoctorUserPic,
    sickRecord.visitDoctorPic,
    sickRecord.bedDoctorPic,
    sickRecord.bedDoctorUserPic,
    sickRecord.doctorPic,
    sickRecord.doctorUserPic,
  );
  const bedDoctorSynopsis = staffText(sickRecord.visitDoctorSynopsis) || staffText(sick.visitDoctorUserRemark);
  const dutyNurseName = staffText(sick.dutyNurseName);
  const dutyNursePic = staffPicText(
    sick.dutyNurseUserPic,
    sickRecord.dutyNursePic,
    sickRecord.nursePic,
    sickRecord.nurseUserPic,
  );
  const dutyNurseSynopsis = staffText(sickRecord.dutyNurseSynopsis) || staffText(sick.dutyNurseUserRemark);

  return [
    {
      role: '主治医生' as const,
      roleKey: 'bedDoctor' as const,
      name: bedDoctorName || '--',
      pic: bedDoctorPic,
      synopsis: bedDoctorSynopsis,
      placeholderLabel: '医' as const,
    },
    {
      role: '责任护士' as const,
      roleKey: 'dutyNurse' as const,
      name: dutyNurseName || '--',
      pic: dutyNursePic,
      synopsis: dutyNurseSynopsis,
      placeholderLabel: '护' as const,
    },
  ];
});

const otherCareStaff = computed(() => {
  const selectedBed = props.selectedBed;
  const fallbackBed = props.ward?.beds.find(bed => bed.sickInfo || bed.bedDeviceInfo) ?? null;
  const bed = selectedBed ?? fallbackBed;
  const sick = bed?.sickInfo ?? null;
  const directorName = staffText(bed?.bedDeviceInfo?.deptDirectorName);
  const headNurseName = staffText(sick?.areaHeadNurseName);

  return [
    {
      role: '主任医生' as const,
      roleKey: 'deptDirector' as const,
      name: directorName || '--',
      placeholderLabel: '医' as const,
    },
    {
      role: '护士长' as const,
      roleKey: 'areaHeadNurse' as const,
      name: headNurseName || '--',
      placeholderLabel: '护' as const,
    },
  ];
});

const inspectionRecords = computed(() => {
  const records = props.inspectionSummary?.records ?? [];
  const scoped = props.selectedBed
    ? records.filter(record => record.bedCode === props.selectedBed?.bedCode)
    : records;
  return scoped.slice(0, 3);
});

function inspectionTime(value: string | null | undefined) {
  if (!value)
    return '--';
  const match = value.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : value;
}



const envItems = computed(() => {

  const env = props.ward?.doorEnvData;

  if (!env)

    return [];

  return [

    { key: 'temp', label: '温度', value: env.temp != null && env.temp !== '' ? `${env.temp}` : '--' },

    { key: 'relativeHumid', label: '湿度', value: env.relativeHumid || '--' },

    { key: 'airQuality', label: '空气质量', value: env.airQuality || '--' },

    { key: 'noiseLevel', label: '噪音', value: env.noiseLevel || '--' },

  ];

});



function bedStatusLabel(bed: TwinBedEntity) {

  return resolveBedStatus(bed).label;

}



function bedStatusColor(bed: TwinBedEntity) {

  return resolveBedStatus(bed).color;

}

function severityLabel(severity: AlertTask['severity']) {
  if (severity === 'critical')
    return '紧急';
  if (severity === 'high')
    return '重要';
  return '提醒';
}

function typeLabel(type: AlertTask['type']) {
  if (type === 'call')
    return '床位呼叫';
  if (type === 'env')
    return '环境异常';
  if (type === 'offline')
    return '设备巡检';
  if (type === 'inspection')
    return '巡视超时';
  return '输液巡视';
}

function isDisplayOnlySwpCall(task: AlertTask) {
  return task.source === 'swp-call' && task.type === 'call';
}

function isSourceManagedTask(task: AlertTask) {
  return isDisplayOnlySwpCall(task) || task.source === 'swp-inspection';
}

function taskStatusText(task: AlertTask) {
  if (isDisplayOnlySwpCall(task))
    return '呼叫中';
  if (task.source === 'swp-inspection')
    return '待巡视';
  if (task.status !== 'handling')
    return '待处理';
  return '处理中';
}

function handlingActionText() {
  return '标记处理中';
}

</script>



<template>

  <div class="ward-info-panel">

    <section v-if="area && ward" class="ward-info-panel__header">

      <h2>{{ ward.sickroomName }}</h2>

      <p class="ward-info-panel__subtitle">

        {{ area.deptName }} · {{ area.areaName }}

      </p>

    </section>



    <section
      v-if="activeAlertTask"
      class="ward-info-panel__task"
      :class="[
        `ward-info-panel__task--${activeAlertTask.severity}`,
        { 'ward-info-panel__task--handling': activeAlertTask.status === 'handling' },
      ]"
    >
      <div class="task-card__head">
        <span>{{ severityLabel(activeAlertTask.severity) }}</span>
        <strong>{{ typeLabel(activeAlertTask.type) }}</strong>
        <em>{{ taskStatusText(activeAlertTask) }}</em>
      </div>
      <p>{{ activeAlertTask.description }}</p>
      <div class="task-card__meta">
        <span>{{ activeAlertTask.roomName }}</span>
        <span v-if="activeAlertTask.bedName">{{ formatBedLabel(activeAlertTask.bedName) }}</span>
        <span v-if="activeAlertTask.patientName">{{ maskSickName(activeAlertTask.patientName) }}</span>
      </div>
      <div class="task-card__actions">
        <button
          v-if="!isSourceManagedTask(activeAlertTask) && activeAlertTask.status !== 'handling'"
          type="button"
          @click="emit('markAlertHandling', activeAlertTask.id)"
        >
          {{ handlingActionText() }}
        </button>
        <span v-if="!isSourceManagedTask(activeAlertTask) && activeAlertTask.status === 'handling'">
          等待状态恢复后自动结束
        </span>
      </div>
    </section>



    <section v-if="ward && bedStats" class="ward-info-panel__stats">

      <div class="stat-chip">

        <span class="stat-chip__val">{{ bedStats.total }}</span>

        <span class="stat-chip__label">总床位</span>

      </div>

      <div class="stat-chip stat-chip--occupied">

        <span class="stat-chip__val">{{ bedStats.occupied }}</span>

        <span class="stat-chip__label">在院</span>

      </div>

      <div class="stat-chip stat-chip--empty">

        <span class="stat-chip__val">{{ bedStats.empty }}</span>

        <span class="stat-chip__label">空床</span>

      </div>

    </section>



    <section
      v-if="inspectionSummary"
      class="ward-info-panel__inspection"
      :class="`ward-info-panel__inspection--${inspectionSummary.state}`"
    >
      <div class="inspection-card__head">
        <div>
          <span>巡视状态</span>
          <strong>{{ inspectionSummary.stateLabel }}</strong>
        </div>
        <small v-if="inspectionSummary.latestAt">
          最近 {{ inspectionTime(inspectionSummary.latestAt) }}
        </small>
      </div>
      <ul v-if="inspectionRecords.length">
        <li v-for="record in inspectionRecords" :key="record.id">
          <i :class="`is-${record.state}`" aria-hidden="true" />
          <span>
            <strong>
              {{ record.bedName ? formatBedLabel(record.bedName) : ward?.sickroomName }}
            </strong>
            <small>{{ record.nursingLevel || record.stateLabel }}</small>
          </span>
          <span class="inspection-card__operator">
            <strong>{{ record.nurseName || '巡视人员待同步' }}</strong>
            <small>{{ inspectionTime(record.occurredAt) }}</small>
          </span>
        </li>
      </ul>
      <p v-else>暂无巡视记录，等待真实巡视数据同步。</p>
      <div class="inspection-card__foot">
        最近巡视记录仅展示最新 3 条；现场产生新记录后状态自动更新。
      </div>
    </section>

    <DoorStaffCards
      v-if="ward"
      :staff="ward.doorStaff"
      :dept-users="ward.doorDeptUsers"
      :managed-care-staff="managedCareStaff"
      :other-care-staff="otherCareStaff"
    />



    <section

      v-if="envItems.length"

      class="ward-info-panel__env"

      :class="`ward-info-panel__env--${envAlert.level}`"

    >

      <h3>环境数据</h3>

      <div class="ward-info-panel__env-grid">

        <div

          v-for="item in envItems"

          :key="item.key"

          class="env-item"

          :class="{

            'env-item--alert': envAlert.items.some(a => a.field === item.key),

          }"

        >

          <span class="env-label">{{ item.label }}</span>

          <span class="env-value">{{ item.value }}</span>

        </div>

      </div>

      <ul v-if="envAlert.items.length" class="env-alert-list">

        <li v-for="(item, i) in envAlert.items" :key="i">

          {{ item.message }}

        </li>

      </ul>

    </section>



    <section v-if="selectedBed && selectedStatus" class="ward-info-panel__bed">

      <div class="ward-info-panel__bed-header">

        <h3>{{ selectedBed.bedName }}</h3>

        <button class="close-btn" @click="emit('close')">

          ×

        </button>

      </div>

      <div class="status-badge" :style="{ backgroundColor: selectedStatus.color }">

        {{ selectedStatus.label }}

      </div>



      <div v-if="selectedBed.isCalling" class="call-alert">

        床位正在呼叫护士站

      </div>



      <div v-if="selectedBed.nursingLabels?.length" class="nursing-tags">

        <span

          v-for="tag in selectedBed.nursingLabels"

          :key="tag.labelCode"

          class="nursing-tag"

          :style="{ backgroundColor: tag.labelColor, color: tag.labelTextColor ?? '#fff' }"

        >

          {{ tag.labelName }}

        </span>

      </div>



      <template v-if="selectedBed.sickInfo">

        <dl class="patient-info">

          <dt>患者</dt>

          <dd>{{ maskSickName(selectedBed.sickInfo.sickName) }}</dd>

          <dt>性别/年龄</dt>

          <dd>{{ selectedBed.sickInfo.sickSex }} / {{ selectedBed.sickInfo.sickAge }}岁</dd>

          <dt>住院号</dt>

          <dd>{{ selectedBed.sickInfo.sickNo }}</dd>

          <dt>入院时间</dt>

          <dd>{{ selectedBed.sickInfo.sickInTime || '--' }}</dd>

          <dt>护理等级</dt>

          <dd :style="{ color: selectedBed.sickInfo.nursingColor }">

            {{ selectedBed.sickInfo.nursingLevel }}

          </dd>

          <dt>主治医生</dt>

          <dd>{{ selectedBed.sickInfo.visitDoctorName }}</dd>

          <dt>责任护士</dt>

          <dd>{{ selectedBed.sickInfo.dutyNurseName }}</dd>

          <dt>饮食</dt>

          <dd>{{ selectedBed.sickInfo.sickDiet || '无' }}</dd>

          <dt>过敏史</dt>

          <dd>{{ selectedBed.sickInfo.sickAllergy || '无' }}</dd>

          <dt>隔离方式</dt>

          <dd>{{ selectedBed.sickInfo.sickIsolation || '无' }}</dd>

          <dt v-if="selectedBed.sickInfo.sickSafetyPrecautions">安全防护</dt>

          <dd v-if="selectedBed.sickInfo.sickSafetyPrecautions">

            {{ selectedBed.sickInfo.sickSafetyPrecautions }}

          </dd>

        </dl>

      </template>

      <section v-if="selectedBed.latestVitals" class="vitals-card" aria-label="最新体征">
        <h4>最新体征</h4>
        <div class="vitals-grid">
          <span>
            <small>体温</small>
            <strong>{{ selectedBed.latestVitals.temp || '--' }}</strong>
          </span>
          <span>
            <small>脉搏</small>
            <strong>{{ selectedBed.latestVitals.pulse || '--' }}</strong>
          </span>
          <span>
            <small>呼吸</small>
            <strong>{{ selectedBed.latestVitals.breath || '--' }}</strong>
          </span>
          <span>
            <small>血压</small>
            <strong>{{ selectedBed.latestVitals.bloodPressure || '--' }}</strong>
          </span>
          <span>
            <small>血糖</small>
            <strong>{{ selectedBed.latestVitals.bloodSugar || '--' }}</strong>
          </span>
          <span>
            <small>记录时间</small>
            <strong>{{ selectedBed.latestVitals.recordTime || '--' }}</strong>
          </span>
        </div>
      </section>

      <p v-if="!selectedBed.sickInfo" class="empty-bed-tip">

        当前为空床

      </p>



      <div v-if="['300', '301'].includes(selectedBed.statusBarInfo?.status ?? '')" class="infusion-info">

        <span>输液泵运行中</span>

      </div>

      <div v-else-if="['302', '305'].includes(selectedBed.statusBarInfo?.status ?? '')" class="infusion-info infusion-info--done">

        <span>输液已完成</span>

      </div>

    </section>



    <section v-else-if="ward" class="ward-info-panel__hint">

      <p>点击场景中的床位查看详情</p>

      <ul class="bed-list">

        <li v-for="bed in ward.beds" :key="bed.bedCode">

          <span class="bed-name">

            <i class="bed-dot" :style="{ backgroundColor: bedStatusColor(bed) }" />

            {{ bed.bedName }}

          </span>

          <span class="bed-meta">

            <span class="bed-patient">{{ displayPatientName(bed.sickInfo?.sickName, bed.isOccupied) }}</span>

            <span class="bed-status">{{ bedStatusLabel(bed) }}</span>

          </span>

        </li>

      </ul>

    </section>



    <StatusHistory :history="statusHistory" />

  </div>

</template>



<style scoped lang="scss">

@keyframes ward-panel-sweep {
  0% {
    opacity: 0;
    transform: translateX(-120%);
  }

  18%,
  62% {
    opacity: 0.72;
  }

  100% {
    opacity: 0;
    transform: translateX(240%);
  }
}

@keyframes ward-panel-rail {
  0%,
  100% {
    opacity: 0.32;
    transform: translateY(-18%);
  }

  50% {
    opacity: 0.9;
    transform: translateY(72%);
  }
}

@keyframes ward-panel-dot-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(77, 234, 255, 0.04), 0 0 8px currentColor;
  }

  50% {
    box-shadow: 0 0 0 4px rgba(77, 234, 255, 0.1), 0 0 16px currentColor;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ward-info-panel,
  .ward-info-panel::before,
  .ward-info-panel::after,
  .ward-info-panel .bed-dot,
  .ward-info-panel :deep(.door-staff-cards)::before,
  .ward-info-panel :deep(.status-history)::before {
    animation: none;
  }
}

.ward-info-panel {

  height: 100%;

  position: relative;
  isolation: isolate;
  padding: 18px 18px 24px;

  background: transparent;

  border-left: none;

  box-shadow: none;

  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(77, 208, 255, 0.35) transparent;
  color: #e8f8ff;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(135deg, rgba(94, 231, 255, 0.1), transparent 28%),
      repeating-linear-gradient(
        90deg,
        rgba(110, 231, 255, 0.028) 0,
        rgba(110, 231, 255, 0.028) 1px,
        transparent 1px,
        transparent 34px
      ),
      repeating-linear-gradient(
        0deg,
        rgba(110, 231, 255, 0.018) 0,
        rgba(110, 231, 255, 0.018) 1px,
        transparent 1px,
        transparent 34px
      );
    opacity: 0.58;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 8px;
    bottom: 0;
    z-index: 0;
    width: 2px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(108, 237, 255, 0.72) 26%,
      rgba(108, 237, 255, 0.08) 48%,
      rgba(108, 237, 255, 0.72) 72%,
      transparent 100%
    );
    filter: blur(0.2px);
    animation: ward-panel-rail 7s ease-in-out infinite;
  }

  > * {
    position: relative;
    z-index: 1;
  }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb {
    background: rgba(77, 208, 255, 0.25);
    border-radius: 4px;
  }



  h3 {

    margin: 0 0 10px;

    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;

    color: #9be8ff;
    text-shadow: 0 0 10px rgba(77, 224, 255, 0.24);

  }

  &__door,
  &__env,
  &__bed,
  &__inspection,
  &__hint {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(6, 20, 36, 0.28);
    border-color: rgba(83, 222, 255, 0.2);
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 38%;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(90deg, rgba(125, 238, 255, 0.88), transparent);
      box-shadow: 0 0 12px rgba(77, 224, 255, 0.44);
      animation: ward-panel-sweep 6.8s ease-in-out infinite;
    }
  }



  &__header {

    margin-bottom: 14px;
    padding: 14px;
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(145deg, rgba(14, 57, 82, 0.68), rgba(5, 21, 38, 0.42)),
      rgba(7, 22, 39, 0.22);
    border: 1px solid rgba(83, 222, 255, 0.28);
    border-left: 3px solid rgba(83, 222, 255, 0.82);
    border-radius: 10px;
    box-shadow:
      0 12px 26px rgba(0, 0, 0, 0.16),
      inset 0 1px 0 rgba(193, 247, 255, 0.1),
      inset 0 0 20px rgba(47, 199, 238, 0.06);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 48%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(149, 245, 255, 0.86));
      box-shadow: 0 0 14px rgba(83, 222, 255, 0.42);
    }

    &::after {
      content: 'WARD // LIVE';
      position: absolute;
      top: 10px;
      right: 12px;
      color: rgba(156, 239, 255, 0.62);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }

    h2 {
      margin: 0;
      padding-right: 92px;
      font-size: 22px;
      color: #fff;
      line-height: 1.2;
      letter-spacing: 0.04em;
      text-shadow: 0 0 16px rgba(77, 224, 255, 0.35);
    }

  }



  &__subtitle {

    margin: 4px 0 0;

    font-size: 13px;

    color: rgba(180, 211, 236, 0.82);

  }



  &__stats {

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));

    gap: 8px;

    margin-bottom: 14px;

  }



  &__task {
    margin-bottom: 14px;
    padding: 13px;
    border: 1px solid rgba(255, 183, 77, 0.34);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(54, 28, 10, 0.28), rgba(6, 20, 36, 0.34));
    box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.035);

    &--critical {
      border-color: rgba(255, 82, 82, 0.42);
      background: linear-gradient(135deg, rgba(64, 15, 24, 0.34), rgba(6, 20, 36, 0.34));
      box-shadow: inset 3px 0 0 rgba(255, 82, 82, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    &--medium {
      border-color: rgba(77, 208, 255, 0.24);
      background: linear-gradient(135deg, rgba(8, 40, 56, 0.3), rgba(6, 20, 36, 0.34));
      box-shadow: inset 3px 0 0 rgba(77, 208, 255, 0.78), inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    &--handling {
      background: linear-gradient(135deg, rgba(8, 44, 56, 0.38), rgba(6, 20, 36, 0.34));
    }

    p {
      margin: 8px 0 9px;
      color: rgba(230, 243, 255, 0.9);
      font-size: 12px;
      line-height: 1.55;
    }
  }

  .task-card__head,
  .task-card__meta,
  .task-card__actions {
    display: flex;
    align-items: center;
  }

  .task-card__head {
    gap: 7px;
    min-width: 0;

    span,
    em {
      flex-shrink: 0;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-style: normal;
      font-weight: 900;
    }

    span {
      color: #fff;
      background: rgba(255, 82, 82, 0.78);
    }

    strong {
      min-width: 0;
      color: #fff;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    em {
      margin-left: auto;
      color: #9be8ff;
      background: rgba(77, 208, 255, 0.14);
    }
  }

  .task-card__meta {
    flex-wrap: wrap;
    gap: 6px;

    span {
      padding: 3px 7px;
      border-radius: 999px;
      color: rgba(205, 226, 240, 0.8);
      background: rgba(255, 255, 255, 0.06);
      font-size: 11px;
      font-weight: 750;
    }
  }

  .task-card__actions {
    gap: 8px;
    margin-top: 10px;

    > span {
      color: rgba(184, 224, 238, 0.82);
      font-size: 11px;
      font-weight: 750;
    }

    button {
      min-height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(129, 212, 250, 0.32);
      border-radius: 7px;
      background: rgba(14, 48, 78, 0.58);
      color: #e8f9ff;
      font-family: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;

      &:hover {
        border-color: rgba(129, 212, 250, 0.72);
        background: rgba(25, 118, 210, 0.48);
      }
    }
  }



  .stat-chip {

    flex: 1;

    position: relative;
    min-height: 66px;
    overflow: hidden;
    padding: 12px 12px 10px;

    text-align: left;

    background:
      linear-gradient(145deg, rgba(9, 46, 68, 0.7), rgba(5, 24, 42, 0.46)),
      rgba(6, 20, 36, 0.3);

    border-radius: 9px;

    border: 1px solid rgba(83, 222, 255, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      0 6px 16px rgba(0, 0, 0, 0.1);
    transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 42%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(143, 243, 255, 0.78));
      box-shadow: 0 0 10px rgba(77, 224, 255, 0.36);
    }

    &::after {
      content: '';
      position: absolute;
      right: 10px;
      bottom: 9px;
      width: 22px;
      height: 22px;
      border: 1px solid rgba(113, 232, 255, 0.24);
      border-radius: 50%;
      opacity: 0.72;
    }

    &:hover {
      border-color: rgba(129, 237, 255, 0.52);
      box-shadow:
        inset 0 1px 0 rgba(193, 247, 255, 0.14),
        0 0 18px rgba(55, 206, 255, 0.14);
      transform: translateY(-1px);
    }



    &__val {

      display: block;

      font-size: 22px;

      font-weight: 700;

      color: #76e7ff;
      line-height: 1;
      text-shadow: 0 0 13px rgba(77, 224, 255, 0.42);

    }



    &__label {

      margin-top: 6px;
      font-size: 10px;

      color: rgba(174, 204, 229, 0.82);
      letter-spacing: 0.08em;

    }



    &--occupied .stat-chip__val { color: #81c784; }

    &--empty .stat-chip__val { color: #9e9e9e; }

  }



  &__door,

  &__staff {

    margin-bottom: 14px;

    padding: 14px;

    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(6, 20, 36, 0.28);

    border: 1px solid rgba(83, 222, 255, 0.2);

    border-radius: 10px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);

  }

  &__inspection {
    margin-bottom: 14px;
    padding: 13px;
    border: 1px solid rgba(88, 226, 198, 0.22);
    border-radius: 10px;
    box-shadow: inset 3px 0 0 rgba(88, 226, 198, 0.52);

    &--due {
      border-color: rgba(255, 190, 91, 0.3);
      box-shadow: inset 3px 0 0 rgba(255, 190, 91, 0.72);
    }

    &--overdue {
      border-color: rgba(255, 101, 91, 0.42);
      box-shadow:
        inset 3px 0 0 rgba(255, 101, 91, 0.86),
        0 0 18px rgba(255, 75, 69, 0.07);
    }

    > p {
      margin: 9px 0;
      color: rgba(187, 216, 230, 0.76);
      font-size: 11px;
    }
  }

  .inspection-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    > div {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    span,
    small {
      color: rgba(177, 213, 228, 0.74);
      font-size: 10px;
    }

    strong {
      color: #8af4dc;
      font-size: 14px;
    }
  }

  &__inspection--due .inspection-card__head strong {
    color: #ffd185;
  }

  &__inspection--overdue .inspection-card__head strong {
    color: #ff9289;
  }

  &__inspection ul {
    display: grid;
    gap: 6px;
    padding: 0;
    margin: 10px 0 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: 7px minmax(0, 1fr) minmax(82px, auto);
      align-items: center;
      gap: 8px;
      padding: 7px 8px;
      border: 1px solid rgba(255, 255, 255, 0.055);
      border-radius: 7px;
      background: rgba(3, 16, 28, 0.34);
    }

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #62e6c5;
      box-shadow: 0 0 8px rgba(98, 230, 197, 0.6);

      &.is-due {
        background: #ffc45f;
        box-shadow: 0 0 8px rgba(255, 196, 95, 0.62);
      }

      &.is-overdue {
        background: #ff6e64;
        box-shadow: 0 0 8px rgba(255, 110, 100, 0.72);
      }
    }

    span {
      display: grid;
      min-width: 0;
      gap: 2px;
    }

    strong {
      overflow: hidden;
      color: #eafaff;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: rgba(171, 205, 220, 0.7);
      font-size: 9px;
    }
  }

  .inspection-card__operator {
    text-align: right;
  }

  .inspection-card__foot {
    margin-top: 9px;
    padding-top: 7px;
    border-top: 1px solid rgba(97, 219, 239, 0.1);
    color: rgba(158, 196, 212, 0.62);
    font-size: 9px;
    line-height: 1.45;
  }



  .door-meta {

    margin: 0;

    display: grid;

    grid-template-columns: 76px 1fr;

    gap: 7px 12px;

    font-size: 12px;



    dt { color: rgba(144, 174, 199, 0.82); margin: 0; }

    dd { margin: 0; color: rgba(230, 243, 255, 0.94); word-break: break-all; }

  }



  &__env {

    margin-bottom: 14px;

    padding: 14px;

    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(6, 20, 36, 0.28);

    border: 1px solid rgba(83, 222, 255, 0.2);

    border-radius: 10px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);



    &--warning {

      border-left: 3px solid #ff9800;

      background: rgba(255, 152, 0, 0.08);

    }

    &--danger {

      border-left: 3px solid #ff1744;

      background: rgba(255, 23, 68, 0.08);

    }

  }



  .env-item--alert .env-value {

    color: #ffb74d;

    font-weight: 700;

  }



  .env-alert-list {

    margin: 10px 0 0;

    padding: 0 0 0 16px;

    font-size: 12px;

    color: #ffb74d;

    li { margin-bottom: 2px; }

  }



  &__env-grid {

    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 10px;

  }



  .env-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 10px;
    background:
      linear-gradient(135deg, rgba(8, 47, 69, 0.52), rgba(5, 22, 39, 0.3)),
      rgba(4, 16, 30, 0.26);
    border: 1px solid rgba(119, 231, 255, 0.14);
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(193, 247, 255, 0.06);
    transition: border-color 180ms ease, box-shadow 180ms ease;

    &:hover {
      border-color: rgba(129, 237, 255, 0.4);
      box-shadow: 0 0 14px rgba(55, 206, 255, 0.12);
    }
  }

  .env-label {
    font-size: 10px;
    color: rgba(144, 192, 214, 0.86);
    letter-spacing: 0.08em;
  }

  .env-value {
    font-size: 18px;
    font-weight: 700;
    color: #e9f8ff;
    text-shadow: 0 0 11px rgba(77, 224, 255, 0.3);
  }



  &__bed {

    margin-bottom: 14px;

    padding: 14px;

    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(7, 22, 39, 0.22);

    border: 1px solid rgba(83, 222, 255, 0.22);

    border-radius: 10px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);

  }



  &__bed-header {

    display: flex;

    justify-content: space-between;

    align-items: center;

    h3 { margin: 0; font-size: 18px; color: #fff; }

  }



  .close-btn {

    background: none;

    border: none;

    color: #94bdd8;

    font-size: 22px;
    line-height: 1;
    width: 30px;
    height: 30px;
    border-radius: 8px;

    cursor: pointer;

    &:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }

  }



  .status-badge {

    display: inline-block;

    margin: 10px 0;

    padding: 4px 12px;

    border-radius: 999px;

    font-size: 13px;

    color: #fff;

  }



  .nursing-tags {

    display: flex;

    flex-wrap: wrap;

    gap: 6px;

    margin-bottom: 10px;

  }



  .nursing-tag {

    padding: 3px 8px;

    border-radius: 999px;

    font-size: 11px;

  }



  .patient-info {

    margin: 12px 0 0;

    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 8px 12px;

    dt { margin: 0; font-size: 12px; color: rgba(144, 174, 199, 0.82); &:first-child { margin-top: 0; } }

    dd { margin: 0; font-size: 13px; color: rgba(232, 244, 255, 0.94); min-width: 0; word-break: break-word; }

  }



  .empty-bed-tip { color: rgba(174, 204, 229, 0.82); font-size: 14px; }

  .vitals-card {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid rgba(77, 208, 255, 0.12);
    border-radius: 10px;
    background: rgba(4, 16, 30, 0.24);

    h4 {
      margin: 0 0 10px;
      color: #9be8ff;
      font-size: 12px;
      font-weight: 700;
    }
  }

  .vitals-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;

    span {
      min-width: 0;
      padding: 8px;
      border-radius: 8px;
      background: rgba(6, 20, 36, 0.32);
      border: 1px solid rgba(255, 255, 255, 0.045);
    }

    small,
    strong {
      display: block;
      min-width: 0;
    }

    small {
      margin-bottom: 4px;
      color: rgba(144, 174, 199, 0.82);
      font-size: 10px;
    }

    strong {
      color: rgba(232, 244, 255, 0.94);
      font-size: 12px;
      font-weight: 750;
      overflow-wrap: anywhere;
    }
  }



  .infusion-info {

    margin-top: 12px;

    padding: 8px 12px;

    background: rgba(255, 152, 0, 0.2);

    border-left: 3px solid #ff9800;

    border-radius: 8px;

    font-size: 13px;

    color: #ffb74d;

  }

  .infusion-info--done {

    background: rgba(0, 199, 66, 0.16);

    border-left-color: #00c742;

    color: #69e58c;

  }



  .call-alert {

    margin: 8px 0;

    padding: 8px 12px;

    background: rgba(233, 30, 99, 0.2);

    border-left: 3px solid #e91e63;

    border-radius: 8px;

    font-size: 13px;

    color: #f48fb1;

    animation: call-pulse 1.2s ease-in-out infinite;

  }



  @keyframes call-pulse {

    0%, 100% { opacity: 1; }

    50% { opacity: 0.65; }

  }



  &__hint {

    margin-bottom: 14px;
    padding: 14px;
    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(6, 20, 36, 0.26);
    border: 1px solid rgba(83, 222, 255, 0.2);
    border-radius: 10px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);

    p {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(195, 232, 248, 0.9);
      font-size: 13px;
      margin: 0 0 12px;
      letter-spacing: 0.04em;

      &::before {
        content: '⌁';
        color: #7cecff;
        font-size: 17px;
        text-shadow: 0 0 10px rgba(77, 224, 255, 0.72);
      }
    }

  }



  .bed-list {

    list-style: none;

    padding: 0;

    margin: 0;



    li {

      display: flex;

      justify-content: space-between;

      align-items: center;

      gap: 8px;

      padding: 9px 0;

      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;

      font-size: 14px;

      &:hover {
        background: linear-gradient(90deg, rgba(77, 224, 255, 0.1), transparent);
        border-bottom-color: rgba(131, 237, 255, 0.3);
        transform: translateX(3px);
      }

    }



    .bed-name {

      display: flex;

      align-items: center;

      gap: 6px;

      color: rgba(190, 218, 240, 0.86);

      flex-shrink: 0;

    }



    .bed-dot {

      width: 8px;

      height: 8px;

      border-radius: 50%;

      flex-shrink: 0;
      color: currentColor;
      animation: ward-panel-dot-pulse 2.8s ease-in-out infinite;

    }



    .bed-meta {

      display: flex;

      flex-direction: column;

      align-items: flex-end;

      gap: 2px;

      min-width: 0;

    }



    .bed-patient {

      color: rgba(232, 244, 255, 0.94);

      max-width: 120px;

      overflow: hidden;

      text-overflow: ellipsis;

      white-space: nowrap;

    }



    .bed-status {

      font-size: 11px;

      color: rgba(144, 174, 199, 0.82);
      letter-spacing: 0.04em;

    }

  }

  :deep(.door-staff-cards) {
    position: relative;
    margin-bottom: 14px;
    padding: 15px 14px 14px;
    background:
      radial-gradient(circle at 16% 0%, rgba(82, 222, 255, 0.14), transparent 34%),
      radial-gradient(circle at 86% 20%, rgba(245, 143, 177, 0.1), transparent 32%),
      linear-gradient(145deg, rgba(10, 44, 67, 0.66), rgba(5, 22, 39, 0.42)),
      rgba(6, 20, 36, 0.28);
    border: 1px solid rgba(83, 222, 255, 0.22);
    border-radius: 12px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);
  }

  :deep(.door-staff-cards)::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 46%;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(143, 243, 255, 0.86));
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.42);
    animation: ward-panel-sweep 7.4s ease-in-out infinite;
  }

  :deep(.door-staff-cards__head) {
    margin-bottom: 12px;
  }

  :deep(.door-staff-cards__title) {
    margin-bottom: 0;
    color: #b9f4ff;
    letter-spacing: 0.12em;
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.34);
  }

  :deep(.door-staff-cards__primary) {
    gap: 12px;
  }

  :deep(.door-staff-cards__other) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  :deep(.staff-role-card) {
    min-height: 148px;
    padding: 15px 10px 13px;
    border-radius: 12px;
    background:
      radial-gradient(circle at 50% 12%, rgba(78, 223, 255, 0.12), transparent 46%),
      linear-gradient(160deg, rgba(8, 48, 71, 0.66), rgba(5, 24, 41, 0.42)),
      rgba(4, 16, 30, 0.26);
    border-color: rgba(119, 231, 255, 0.16);
    box-shadow:
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      0 5px 14px rgba(0, 0, 0, 0.12);
  }

  :deep(.staff-role-card--inline) {
    min-height: 64px;
    padding: 10px 12px;
  }

  :deep(.staff-role-card:hover) {
    border-color: rgba(131, 237, 255, 0.46);
    box-shadow:
      inset 0 1px 0 rgba(193, 247, 255, 0.14),
      0 0 18px rgba(55, 206, 255, 0.14);
  }

  :deep(.staff-role-card__name) {
    text-shadow: 0 0 10px rgba(77, 224, 255, 0.22);
  }

  :deep(.door-staff-cards__dept) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    border-top-color: rgba(83, 222, 255, 0.18);
  }

  :deep(.door-staff-cards__dept li) {
    min-width: 0;
    padding: 8px 9px;
    background: linear-gradient(135deg, rgba(7, 37, 58, 0.72), rgba(5, 20, 36, 0.48));
    border: 1px solid rgba(119, 231, 255, 0.13);
    border-radius: 10px;
  }

  :deep(.status-history) {
    position: relative;
    overflow: hidden;
    margin-top: 16px;
    padding: 13px;
    background:
      linear-gradient(145deg, rgba(10, 42, 64, 0.58), rgba(5, 21, 38, 0.42)),
      rgba(6, 20, 36, 0.28);
    border: 1px solid rgba(83, 222, 255, 0.2);
    border-radius: 10px;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.08),
      inset 3px 0 0 rgba(77, 224, 255, 0.22);
  }

  :deep(.status-history)::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 42%;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(125, 238, 255, 0.88), transparent);
    box-shadow: 0 0 12px rgba(77, 224, 255, 0.44);
    animation: ward-panel-sweep 8s ease-in-out infinite;
  }

  :deep(.status-history h3) {
    color: #b9f4ff;
    letter-spacing: 0.12em;
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.34);
  }

  :deep(.status-history li) {
    border-bottom-color: rgba(119, 231, 255, 0.1);
    transition: background 180ms ease, transform 180ms ease;
  }

  :deep(.status-history li:hover) {
    background: linear-gradient(90deg, rgba(77, 224, 255, 0.1), transparent);
    transform: translateX(2px);
  }

  @include down($bp-md) {
    padding: 14px;
  }

  @include down($bp-sm) {
    padding: 12px;

    &__header h2 {
      font-size: 18px;
    }

    &__stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat-chip {
      min-width: 0;
      padding: 8px 6px;

      &__val {
        font-size: 17px;
      }
    }

    .bed-patient {
      max-width: 90px;
    }
  }

  @include down($bp-xs) {
    &__stats {
      grid-template-columns: 1fr;
    }
  }
}

</style>
