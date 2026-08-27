<script setup lang="ts">

import { computed } from 'vue';

import { displayPatientName, maskSickName } from '@/utils/mask-patient';

import DoorStaffCards from '@/components/DoorStaffCards.vue';
import StatusHistory from '@/components/StatusHistory.vue';
import { resolveBedStatus } from '@/core/bed-status';
import { formatBedLabel, type AlertTask } from '@/core/alert-workflow';
import type { EnvAlertResult } from '@/core/env-alert';
import { getWardBedStats, type BedStatusMeta, type StatusHistoryEntry, type TwinAreaEntity, type TwinBedEntity, type TwinWardEntity } from '@/types/twin';



const props = defineProps<{

  area: TwinAreaEntity | null;

  ward: TwinWardEntity | null;

  selectedBed: TwinBedEntity | null;

  selectedStatus: BedStatusMeta | null;

  envAlert: EnvAlertResult;

  statusHistory: StatusHistoryEntry[];

  activeAlertTask?: AlertTask | null;

}>();



const emit = defineEmits<{

  close: [];
  markAlertHandling: [taskId: string];
  resolveAlert: [taskId: string];

}>();



const bedStats = computed(() => props.ward ? getWardBedStats(props.ward) : null);



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
  return '输液巡视';
}

function isDisplayOnlySwpCall(task: AlertTask) {
  return task.source === 'swp-call' && task.type === 'call';
}

function taskStatusText(task: AlertTask) {
  if (isDisplayOnlySwpCall(task))
    return '呼叫中';
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
          v-if="!isDisplayOnlySwpCall(activeAlertTask) && activeAlertTask.status !== 'handling'"
          type="button"
          @click="emit('markAlertHandling', activeAlertTask.id)"
        >
          {{ handlingActionText() }}
        </button>
        <span v-if="!isDisplayOnlySwpCall(activeAlertTask) && activeAlertTask.status === 'handling'">
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



    <section v-if="ward" class="ward-info-panel__door">

      <h3>门口机</h3>

      <dl class="door-meta">

        <dt>设备名称</dt>

        <dd>{{ ward.deviceName || '--' }}</dd>

        <dt>设备 SN</dt>

        <dd>{{ ward.deviceCode }}</dd>

        <dt>设备 IP</dt>

        <dd>{{ ward.deviceIp || '--' }}</dd>

        <dt>病房编码</dt>

        <dd>{{ ward.sickroomCode }}</dd>

      </dl>

    </section>



    <DoorStaffCards
      v-if="ward"
      :staff="ward.doorStaff"
      :dept-users="ward.doorDeptUsers"
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

.ward-info-panel {

  height: 100%;

  padding: 16px 18px 20px;

  background: transparent;

  border-left: none;

  box-shadow: none;

  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(77, 208, 255, 0.35) transparent;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb {
    background: rgba(77, 208, 255, 0.25);
    border-radius: 4px;
  }



  h3 {

    margin: 0 0 10px;

    font-size: 13px;
    font-weight: 700;

    color: #9be8ff;

  }



  &__header {

    margin-bottom: 14px;
    padding: 14px;
    background: rgba(7, 22, 39, 0.22);
    border: 1px solid rgba(77, 208, 255, 0.16);
    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

    h2 { margin: 0; font-size: 22px; color: #fff; line-height: 1.2; }

  }



  &__subtitle {

    margin: 4px 0 0;

    font-size: 13px;

    color: rgba(180, 211, 236, 0.82);

  }



  &__stats {

    display: flex;

    gap: 10px;

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

    padding: 12px 8px 11px;

    text-align: center;

    background: rgba(6, 20, 36, 0.3);

    border-radius: 8px;

    border: 1px solid rgba(77, 208, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);



    &__val {

      display: block;

      font-size: 20px;

      font-weight: 700;

      color: #76e7ff;

    }



    &__label {

      font-size: 11px;

      color: rgba(174, 204, 229, 0.82);

    }



    &--occupied .stat-chip__val { color: #81c784; }

    &--empty .stat-chip__val { color: #9e9e9e; }

  }



  &__door,

  &__staff {

    margin-bottom: 14px;

    padding: 14px;

    background: rgba(6, 20, 36, 0.28);

    border: 1px solid rgba(77, 208, 255, 0.11);

    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

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

    background: rgba(6, 20, 36, 0.28);

    border: 1px solid rgba(77, 208, 255, 0.11);

    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);



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
    background: rgba(4, 16, 30, 0.26);
    border: 1px solid rgba(255, 255, 255, 0.045);
    border-radius: 8px;
  }

  .env-label { font-size: 11px; color: rgba(144, 174, 199, 0.82); }

  .env-value { font-size: 17px; font-weight: 700; color: #e9f8ff; }



  &__bed {

    margin-bottom: 14px;

    padding: 14px;

    background: rgba(7, 22, 39, 0.22);

    border: 1px solid rgba(77, 208, 255, 0.13);

    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

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
    background: rgba(6, 20, 36, 0.26);
    border: 1px solid rgba(77, 208, 255, 0.11);
    border-radius: 10px;

    p { color: rgba(174, 204, 229, 0.82); font-size: 13px; margin: 0 0 12px; }

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

      font-size: 14px;

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

    }

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
      flex-wrap: wrap;
    }

    .stat-chip {
      min-width: calc(33.33% - 6px);
      padding: 8px 6px;

      &__val {
        font-size: 17px;
      }
    }

    .bed-patient {
      max-width: 90px;
    }
  }
}

</style>
