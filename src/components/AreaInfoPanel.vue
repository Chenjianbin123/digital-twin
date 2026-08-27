<script setup lang="ts">
import { computed } from 'vue';
import AlertTaskPanel from '@/components/AlertTaskPanel.vue';
import DoorStaffCards from '@/components/DoorStaffCards.vue';
import DashSectionHeader from '@/components/dashboard/DashSectionHeader.vue';
import StatusHistory from '@/components/StatusHistory.vue';
import { resolveBedStatus } from '@/core/bed-status';
import type { AlertAckRecordMap } from '@/core/alert-ack';
import type { RoomSummary } from '@/core/area-summary';
import type { AlertTask } from '@/core/alert-workflow';
import { displayPatientName } from '@/utils/mask-patient';
import { getWardBedStats, type StatusHistoryEntry, type TwinAreaEntity, type TwinBedEntity, type TwinWardEntity } from '@/types/twin';

const props = defineProps<{
  area: TwinAreaEntity | null;
  roomSummaries: RoomSummary[];
  statusHistory: StatusHistoryEntry[];
  focusedRoomIndex?: number;
  showBackToStation?: boolean;
  alertTasks?: AlertTask[];
  alertAckRecords?: AlertAckRecordMap;
}>();

const emit = defineEmits<{
  focusRoom: [index: number];
  enterRoom: [index: number];
  backToStation: [];
  locateAlert: [taskId: string];
  markAlertHandling: [taskId: string];
  resolveAlert: [taskId: string];
}>();

const areaStats = computed(() => {
  if (!props.area)
    return null;

  let totalBeds = 0;
  let occupied = 0;
  let calling = 0;
  let infusing = 0;
  let offline = 0;
  let onlineDevices = 0;

  for (const room of props.area.rooms) {
    const stats = getWardBedStats(room);
    totalBeds += stats.total;
    occupied += stats.occupied;
    if (room.isOnline === true)
      onlineDevices++;
    for (const bed of room.beds) {
      const status = resolveBedStatus(bed);
      if (bed.isCalling)
        calling++;
      if (status.state === 'infusing')
        infusing++;
      if (status.state === 'offline' || status.state === 'lowBattery')
        offline++;
      if (bed.isOnline)
        onlineDevices++;
    }
  }

  const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;
  const stableOccupied = Math.max(0, occupied - calling - infusing);

  return {
    roomCount: props.area.rooms.length,
    totalBeds,
    occupied,
    stableOccupied,
    empty: totalBeds - occupied,
    calling,
    infusing,
    offline,
    onlineDevices,
    occupancyRate,
  };
});

const areaIntro = computed(() => {
  if (!props.area)
    return '';
  return `${props.area.areaName}（${props.area.deptName}）`;
});

const bedMonitorRows = computed(() => {
  const stats = areaStats.value;
  if (!stats)
    return [];
  const total = Math.max(stats.totalBeds, 1);
  return [
    { key: 'stable', label: '在床稳定', tag: '常规', count: stats.stableOccupied, tone: 'cyan' },
    { key: 'infusing', label: '输液中', tag: '输液', count: stats.infusing, tone: 'orange' },
    { key: 'calling', label: '呼叫中', tag: '呼叫', count: stats.calling, tone: 'pink' },
    { key: 'empty', label: '空床', tag: '空床', count: stats.empty, tone: 'slate' },
  ]
    .filter(row => row.count > 0)
    .map(row => ({
      ...row,
      percent: Math.min(100, Math.round((row.count / total) * 100)),
    }));
});

const personnelStats = computed(() => {
  const doctors = new Set<string>();
  const nurses = new Set<string>();
  for (const room of props.area?.rooms ?? []) {
    if (room.doorStaff?.deptDirectorName)
      doctors.add(room.doorStaff.deptDirectorName);
    if (room.doorStaff?.areaDirectorName)
      doctors.add(room.doorStaff.areaDirectorName);
    if (room.doorStaff?.areaHeadNurseName)
      nurses.add(room.doorStaff.areaHeadNurseName);
    for (const bed of room.beds) {
      if (bed.sickInfo?.visitDoctorName)
        doctors.add(bed.sickInfo.visitDoctorName);
      if (bed.sickInfo?.dutyNurseName)
        nurses.add(bed.sickInfo.dutyNurseName);
    }
  }
  return [
    { key: 'doctor', label: '主治医生', value: doctors.size, sub: '责任制医生', tone: 'blue' },
    { key: 'nurse', label: '责任护士', value: nurses.size, sub: '排班在岗', tone: 'teal' },
    { key: 'patient', label: '在院患者', value: areaStats.value?.occupied ?? 0, sub: '实时统计', tone: 'green' },
    { key: 'door', label: '门口机', value: props.area?.rooms.length ?? 0, sub: '已接入', tone: 'violet' },
  ].filter(item => item.value > 0);
});

function getRoom(index: number): TwinWardEntity | undefined {
  return props.area?.rooms[index];
}

function bedStatusColor(bed: TwinBedEntity) {
  return resolveBedStatus(bed).color;
}

function bedStatusLabel(bed: TwinBedEntity) {
  return resolveBedStatus(bed).label;
}

function bedStatusState(bed: TwinBedEntity) {
  return resolveBedStatus(bed).state;
}

function priorityLabel(summary: RoomSummary) {
  const map: Record<string, string> = {
    calling: '呼叫',
    danger: '异常',
    offline: '离线',
    infusing: '输液',
    warning: '预警',
    empty: '空房',
    normal: '正常',
  };
  return map[summary.priority] ?? '正常';
}

function patientDisplay(bed: TwinBedEntity) {
  if (!bed.isOccupied)
    return '待入住';
  return displayPatientName(bed.sickInfo?.sickName, bed.isOccupied);
}
</script>

<template>
  <div class="area-dashboard">
    <button
      v-if="showBackToStation"
      type="button"
      class="area-dashboard__back-station"
      @click="emit('backToStation')"
    >
      ← 返回护士站工作台
    </button>

    <p v-if="areaIntro" class="area-dashboard__intro">{{ areaIntro }}</p>

    <AlertTaskPanel
      :tasks="alertTasks ?? []"
      :ack-records="alertAckRecords"
      title="异常闭环"
      :max-items="4"
      @locate="emit('locateAlert', $event)"
      @mark-handling="emit('markAlertHandling', $event)"
      @resolve="emit('resolveAlert', $event)"
    />

    <section v-if="bedMonitorRows.length" class="dash-section">
      <DashSectionHeader title="床位监测" />
      <ul class="monitor-list">
        <li v-for="row in bedMonitorRows" :key="row.key" class="monitor-row" :class="`monitor-row--${row.tone}`">
          <div class="monitor-row__left">
            <span class="monitor-row__count">当前 <em>{{ row.count }}</em> 床</span>
            <div class="monitor-row__bar">
              <i :style="{ width: `${Math.max(row.percent, row.count > 0 ? 8 : 0)}%` }" />
            </div>
          </div>
          <div class="monitor-row__right">
            <span class="monitor-row__percent">{{ row.percent }}%</span>
            <span class="monitor-row__tag">{{ row.tag }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="personnelStats.length" class="dash-section">
      <DashSectionHeader title="人员构成" />
      <div class="person-grid">
        <article v-for="item in personnelStats" :key="item.key" class="person-card" :class="`person-card--${item.tone}`">
          <span class="person-card__ring" aria-hidden="true" />
          <span class="person-card__label">{{ item.label }}</span>
          <span class="person-card__value">{{ item.value }}</span>
          <span class="person-card__sub">{{ item.sub }}</span>
        </article>
      </div>
    </section>

    <section v-if="areaStats && (areaStats.calling || areaStats.infusing || areaStats.offline)" class="dash-section dash-section--alerts">
      <span v-if="areaStats.calling" class="alert-chip alert-chip--call">呼叫 {{ areaStats.calling }} 床</span>
      <span v-if="areaStats.infusing" class="alert-chip alert-chip--infuse">输液 {{ areaStats.infusing }} 床</span>
      <span v-if="areaStats.offline" class="alert-chip alert-chip--offline">离线 {{ areaStats.offline }} 床</span>
    </section>

    <section v-if="roomSummaries.length" class="dash-section dash-section--rooms">
      <DashSectionHeader title="病房详情" :count="roomSummaries.length" />

      <div class="room-list">
        <article
          v-for="summary in roomSummaries"
          :key="summary.sickroomCode"
          class="room-card"
          :class="[
            `room-card--${summary.priority}`,
            { 'room-card--focused': summary.roomIndex === focusedRoomIndex },
          ]"
          @click="emit('focusRoom', summary.roomIndex)"
        >
          <div class="room-card__accent" :style="{ backgroundColor: summary.accentColor }" />
          <div class="room-card__body">
            <header class="room-card__top">
              <div class="room-card__title-block">
                <span class="room-card__name">{{ summary.sickroomName }}</span>
                <span class="room-card__priority" :class="`room-card__priority--${summary.priority}`">
                  {{ priorityLabel(summary) }}
                </span>
              </div>
              <span class="room-card__badge">{{ summary.occupiedBeds }}/{{ summary.totalBeds }}</span>
            </header>
            <p class="room-card__status">{{ summary.statusText }}</p>

            <template v-if="getRoom(summary.roomIndex)">
              <DoorStaffCards
                :staff="getRoom(summary.roomIndex)!.doorStaff"
                primary-only
                compact
              />
              <ul class="room-card__beds">
                <li
                  v-for="bed in getRoom(summary.roomIndex)!.beds"
                  :key="bed.bedCode"
                  class="bed-chip"
                  :class="[
                    `bed-chip--${bedStatusState(bed)}`,
                    { 'bed-chip--calling': bed.isCalling },
                  ]"
                  :style="{ '--bed-accent': bedStatusColor(bed) }"
                >
                  <span class="bed-chip__no">{{ bed.bedName }}</span>
                  <span class="bed-chip__state">{{ bedStatusLabel(bed) }}</span>
                  <span class="bed-chip__patient">{{ patientDisplay(bed) }}</span>
                </li>
              </ul>
            </template>

            <button type="button" class="room-card__enter" @click.stop="emit('enterRoom', summary.roomIndex)">
              进入病房 →
            </button>
          </div>
        </article>
      </div>
    </section>

    <StatusHistory :history="statusHistory" />
  </div>
</template>

<style scoped lang="scss">
.area-dashboard {
  height: 100%;
  padding: 16px 18px 20px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(77, 208, 255, 0.35) transparent;
  color: #eef8ff;
  background: transparent;
  border-left: none;
  box-shadow: none;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.25);
    border-radius: 4px;
  }

  &__intro {
    margin: 0 0 14px;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.55;
    color: rgba(221, 239, 255, 0.9);
    text-align: justify;
    background: rgba(7, 22, 39, 0.28);
    border: 1px solid rgba(77, 208, 255, 0.12);
    border-radius: 8px;
  }

  &__back-station {
    display: inline-flex;
    align-items: center;
    margin: 0 0 12px;
    padding: 7px 12px;
    border: 1px solid rgba(77, 208, 255, 0.28);
    border-radius: 8px;
    background: rgba(8, 33, 58, 0.34);
    color: #9be8ff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      border-color: rgba(129, 212, 250, 0.65);
      background: rgba(25, 118, 210, 0.32);
    }
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 600;
    color: #4deaff;
    background: linear-gradient(90deg, rgba(0, 132, 199, 0.28), rgba(0, 88, 160, 0.12));
    border: 1px solid rgba(77, 208, 255, 0.42);
    border-radius: 4px;
    box-shadow: 0 0 16px rgba(0, 180, 255, 0.18);
  }

  &__badge-sub {
    font-weight: 500;
    color: rgba(190, 220, 245, 0.82);
    padding-left: 10px;
    border-left: 1px solid rgba(77, 208, 255, 0.28);
  }
}

.dash-section {
  margin-bottom: 16px;
  padding: 13px 13px 14px;
  background: rgba(6, 20, 36, 0.26);
  border: 1px solid rgba(77, 208, 255, 0.11);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  border-bottom-color: rgba(77, 208, 255, 0.11);

  &:last-child {
    margin-bottom: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__mark {
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 8px solid #4deaff;
    filter: drop-shadow(0 0 6px rgba(77, 208, 255, 0.95));
    flex-shrink: 0;
  }

  &__title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: #ffffff;
    white-space: nowrap;
    text-shadow: 0 0 12px rgba(77, 208, 255, 0.25);
  }

  &__count {
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #4deaff;
    background: rgba(0, 120, 200, 0.22);
    border: 1px solid rgba(77, 208, 255, 0.38);
    border-radius: 999px;
    text-shadow: 0 0 8px rgba(77, 208, 255, 0.35);
  }

  &__line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(77, 208, 255, 0.75), rgba(0, 120, 200, 0.15) 75%, transparent);
    box-shadow: 0 0 10px rgba(77, 208, 255, 0.35);
  }

  &--alerts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  &--rooms {
    padding-bottom: 13px;
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 11px 10px;
    background: linear-gradient(135deg, rgba(8, 32, 58, 0.72), rgba(6, 22, 42, 0.55));
    border: 1px solid rgba(77, 208, 255, 0.22);
    border-radius: 6px;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: rgba(77, 208, 255, 0.45);
      box-shadow: 0 0 18px rgba(0, 140, 255, 0.16);
    }
  }

  &__icon {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: rgba(0, 100, 170, 0.28);
    border: 1px solid rgba(77, 208, 255, 0.32);
    position: relative;
    box-shadow: inset 0 0 10px rgba(77, 208, 255, 0.08);

    &::after {
      content: '';
      position: absolute;
      inset: 6px;
      border-radius: 3px;
      background: linear-gradient(135deg, #4deaff, #0099cc);
      opacity: 0.92;
      box-shadow: 0 0 8px rgba(77, 208, 255, 0.45);
    }

    &--ward::after { clip-path: polygon(50% 10%, 90% 40%, 90% 85%, 10% 85%, 10% 40%); }
    &--bed::after { border-radius: 2px; height: 8px; top: 11px; inset-inline: 5px; }
    &--patient::after { border-radius: 50%; width: 10px; height: 10px; top: 5px; left: 9px; box-shadow: 0 8px 0 -2px #00d4ff; }
    &--rate::after { clip-path: polygon(20% 80%, 45% 45%, 65% 60%, 85% 25%, 85% 80%); }
    &--temp::after { border-radius: 50%; width: 8px; height: 8px; top: 6px; left: 10px; box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.4); }
    &--device::after { border-radius: 2px; inset: 7px 5px; box-shadow: 0 0 6px rgba(0, 212, 255, 0.5); }
  }

  &__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 10px;
    color: rgba(180, 210, 235, 0.92);
    letter-spacing: 0.3px;
  }

  &__value {
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #4deaff;
    line-height: 1.1;
    text-shadow: 0 0 14px rgba(77, 208, 255, 0.55);

    small {
      margin-left: 2px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(180, 230, 255, 0.95);
    }
  }
}

.monitor-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.monitor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 12px;
  background: rgba(7, 22, 39, 0.22);
  border: 1px solid rgba(77, 208, 255, 0.14);
  border-radius: 8px;

  &__left {
    flex: 1;
    min-width: 0;
  }

  &__count {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    color: rgba(180, 205, 230, 0.9);

    em {
      font-style: normal;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      margin: 0 2px;
    }
  }

  &__bar {
    height: 6px;
    border-radius: 999px;
    background: rgba(4, 18, 36, 0.85);
    border: 1px solid rgba(77, 208, 255, 0.12);
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      transition: width 0.35s ease;
      box-shadow: 0 0 10px rgba(77, 208, 255, 0.35);
    }
  }

  &__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  &__percent {
    font-size: 13px;
    font-weight: 700;
    color: #4deaff;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 10px rgba(77, 208, 255, 0.45);
  }

  &__tag {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 3px;
    border: 1px solid rgba(77, 208, 255, 0.35);
    color: rgba(220, 240, 255, 0.95);
    background: rgba(0, 100, 170, 0.28);
  }

  &--cyan i { background: linear-gradient(90deg, #006699, #4deaff); }
  &--orange i { background: linear-gradient(90deg, #e65100, #ffb74d); }
  &--pink i { background: linear-gradient(90deg, #c2185b, #f48fb1); }
  &--slate i { background: linear-gradient(90deg, #37474f, #78909c); }
}

.person-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.person-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 10px 12px;
  background: rgba(7, 22, 39, 0.22);
  border: 1px solid rgba(77, 208, 255, 0.2);
  border-radius: 8px;
  text-align: center;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

  &__ring {
    width: 46px;
    height: 46px;
    margin-bottom: 8px;
    border-radius: 50%;
    border: 2px solid rgba(77, 208, 255, 0.48);
    background: radial-gradient(circle at 35% 30%, rgba(77, 208, 255, 0.28), rgba(0, 60, 110, 0.18));
    box-shadow: 0 0 20px rgba(77, 208, 255, 0.28);
  }

  &__label {
    font-size: 11px;
    color: rgba(190, 220, 245, 0.92);
    margin-bottom: 4px;
  }

  &__value {
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
    color: #4deaff;
    text-shadow: 0 0 18px rgba(77, 208, 255, 0.55);
    font-variant-numeric: tabular-nums;
  }

  &__sub {
    margin-top: 5px;
    font-size: 10px;
    color: rgba(77, 208, 255, 0.82);
  }

  &--blue .person-card__ring { border-color: rgba(66, 165, 245, 0.55); }
  &--teal .person-card__ring { border-color: rgba(38, 198, 218, 0.55); }
  &--green .person-card__ring { border-color: rgba(102, 187, 106, 0.55); }
  &--violet .person-card__ring { border-color: rgba(126, 140, 255, 0.55); }
}

.alert-chip {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;

  &--call { color: #f48fb1; background: rgba(233, 30, 99, 0.15); border: 1px solid rgba(233, 30, 99, 0.3); }
  &--infuse { color: #ffb74d; background: rgba(255, 152, 0, 0.12); border: 1px solid rgba(255, 152, 0, 0.28); }
  &--offline { color: #ef9a9a; background: rgba(244, 67, 54, 0.12); border: 1px solid rgba(244, 67, 54, 0.28); }
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.room-card {
  position: relative;
  display: flex;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background:
    rgba(7, 22, 39, 0.22);
  border: 1px solid rgba(77, 208, 255, 0.15);
  transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s, background 0.18s;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.035);

  &:hover {
    transform: translateX(-2px);
    border-color: rgba(77, 208, 255, 0.42);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2), 0 0 18px rgba(77, 208, 255, 0.13);
  }

  &--focused {
    border-color: rgba(77, 208, 255, 0.55);
    box-shadow: 0 0 0 1px rgba(77, 208, 255, 0.22), 0 0 20px rgba(77, 208, 255, 0.12);
  }

  &__accent {
    flex-shrink: 0;
    width: 4px;
  }

  &__body {
    flex: 1;
    min-width: 0;
    padding: 11px 12px 12px;
  }

  &__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__title-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    line-height: 1.25;
  }

  &__priority {
    width: fit-content;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 999px;
    color: rgba(180, 210, 235, 0.9);
    background: rgba(0, 80, 140, 0.3);

    &--calling { color: #f48fb1; background: rgba(233, 30, 99, 0.18); }
    &--infusing { color: #ffb74d; background: rgba(255, 152, 0, 0.15); }
  }

  &__badge {
    flex-shrink: 0;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #8deeff;
    background: rgba(0, 116, 178, 0.22);
    border: 1px solid rgba(77, 208, 255, 0.26);
    border-radius: 999px;
    text-shadow: 0 0 8px rgba(77, 208, 255, 0.3);
  }

  &__status {
    margin: 0 0 8px;
    font-size: 11px;
    color: rgba(170, 200, 225, 0.82);
  }

  &__beds {
    list-style: none;
    margin: 8px 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__enter {
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    color: #d6f4ff;
    background: rgba(0, 113, 180, 0.2);
    border: 1px solid rgba(77, 208, 255, 0.32);
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;

    &:hover {
      background: rgba(0, 120, 200, 0.28);
      box-shadow: 0 0 14px rgba(77, 208, 255, 0.22);
    }
  }
}

.bed-chip {
  display: grid;
  grid-template-columns: minmax(44px, auto) 1fr minmax(58px, auto);
  gap: 8px;
  align-items: center;
  min-height: 30px;
  padding: 6px 8px;
  font-size: 10px;
  background: rgba(3, 17, 32, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.045);
  border-left: 2px solid var(--bed-accent, #00d4ff);
  border-radius: 6px;

  &__no { font-weight: 700; color: #cfd8dc; }
  &__state { color: var(--bed-accent); font-weight: 600; }
  &__patient {
    color: rgba(200, 220, 240, 0.85);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 72px;
  }

  &--calling { animation: call-soft 2s ease-in-out infinite; }
}

:deep(.status-history) {
  margin-top: 0;
  padding: 12px;
  background: rgba(6, 20, 36, 0.26);
  border: 1px solid rgba(77, 208, 255, 0.11);
  border-radius: 10px;

  h3 {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #4deaff;
    text-shadow: 0 0 10px rgba(77, 208, 255, 0.35);
  }
}

:deep(.door-staff-cards) {
  margin-bottom: 6px;
}

@keyframes call-soft {
  0%, 100% { box-shadow: inset 0 0 0 rgba(233, 30, 99, 0); }
  50% { box-shadow: inset 0 0 10px rgba(233, 30, 99, 0.15); }
}

@include down($bp-md) {
  .area-dashboard { padding: 14px 12px; }
}

@include down($bp-sm) {
  .metric-grid__value { font-size: 15px; }
  .person-card__value { font-size: 22px; }
}
</style>
