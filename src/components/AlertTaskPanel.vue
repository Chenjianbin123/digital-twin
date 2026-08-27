<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import DashSectionHeader from '@/components/dashboard/DashSectionHeader.vue';
import {
  formatAlertWaitingTime,
  formatBedLabel,
  getAlertWaitingLevel,
  type AlertTask,
} from '@/core/alert-workflow';
import type { AlertAckRecordMap } from '@/core/alert-ack';

const props = withDefaults(defineProps<{
  tasks: AlertTask[];
  title?: string;
  maxItems?: number;
  compact?: boolean;
  ackRecords?: AlertAckRecordMap;
  hiddenTasks?: AlertTask[];
}>(), {
  title: '待处理告警',
  maxItems: 5,
  compact: false,
  ackRecords: () => ({}),
  hiddenTasks: () => [],
});

const emit = defineEmits<{
  locate: [taskId: string];
  markHandling: [taskId: string];
  resolve: [taskId: string];
  restore: [taskId: string];
}>();

const showAllTasks = ref(false);
const hasExpandableTasks = computed(() => props.tasks.length > props.maxItems);
const visibleTasks = computed(() =>
  showAllTasks.value ? props.tasks : props.tasks.slice(0, props.maxItems),
);
const overflowCount = computed(() =>
  showAllTasks.value ? 0 : Math.max(0, props.tasks.length - props.maxItems),
);
const waitingNow = ref(new Date());
let waitingTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  waitingTimer = setInterval(() => {
    waitingNow.value = new Date();
  }, 30_000);
});

onUnmounted(() => {
  if (waitingTimer)
    clearInterval(waitingTimer);
});

function severityLabel(severity: AlertTask['severity']) {
  if (severity === 'critical')
    return '紧急';
  if (severity === 'high')
    return '重要';
  return '提醒';
}

function typeLabel(type: AlertTask['type']) {
  if (type === 'call')
    return '呼叫';
  if (type === 'env')
    return '环境';
  if (type === 'offline')
    return '设备';
  return '输液';
}

function formatAckTime(taskId: string) {
  const updatedAt = props.ackRecords[taskId]?.updatedAt;
  if (!updatedAt)
    return '';
  return new Date(updatedAt).toLocaleTimeString('zh-CN', { hour12: false });
}

function waitingLabel(task: AlertTask) {
  return isDisplayOnlySwpCall(task)
    ? ''
    : formatAlertWaitingTime(task.startedAt, waitingNow.value);
}

function formatTaskOccurredAt(task: AlertTask) {
  const value = task.startedAt ?? '';
  if (!isDisplayOnlySwpCall(task))
    return value;
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]} ${match[3]}:${match[4]}` : value;
}

function waitingClass(task: AlertTask) {
  const level = getAlertWaitingLevel(task.startedAt, waitingNow.value);
  if (level === 'attention')
    return 'alert-task--waiting-attention';
  if (level === 'urgent')
    return 'alert-task--waiting-urgent';
  return '';
}

function syncLabel(taskId: string) {
  const state = props.ackRecords[taskId]?.syncState;
  if (state === 'synced') return '已同步';
  if (state === 'failed') return '同步失败';
  if (state === 'local') return '本地保存';
  return state === 'pending' ? '同步中' : '';
}

function isDisplayOnlySwpCall(task: AlertTask) {
  return task.source === 'swp-call' && task.type === 'call';
}

function handlingActionText() {
  return '处理中';
}

function canMarkHandling(task: AlertTask) {
  return !isDisplayOnlySwpCall(task) && task.status !== 'handling';
}

function taskStatusText(task: AlertTask) {
  if (isDisplayOnlySwpCall(task))
    return '呼叫中';
  if (task.status !== 'handling')
    return '待处理';
  return '处理中';
}
</script>

<template>
  <section
    class="alert-task-panel"
    :class="{ 'alert-task-panel--compact': compact }"
  >
    <DashSectionHeader :title="title" :count="tasks.length" />

    <div v-if="!visibleTasks.length" class="alert-task-panel__empty">
      <strong>暂无待处理告警</strong>
      <span>系统会自动汇总呼叫、环境、设备和输液异常</span>
    </div>

    <ul v-else class="alert-task-panel__list">
      <li
        v-for="task in visibleTasks"
        :key="task.id"
        class="alert-task"
        :class="[
          `alert-task--${task.severity}`,
          `alert-task--${task.status}`,
          { 'alert-task--swp-call': isDisplayOnlySwpCall(task) },
          waitingClass(task),
        ]"
      >
        <i
          v-if="isDisplayOnlySwpCall(task)"
          class="alert-task__scan"
          aria-hidden="true"
        />
        <div class="alert-task__main">
          <div class="alert-task__head">
            <span
              v-if="isDisplayOnlySwpCall(task)"
              class="alert-task__signal"
              aria-label="活动呼叫信号"
            >
              <i aria-hidden="true" />
            </span>
            <span class="alert-task__severity">{{ severityLabel(task.severity) }}</span>
            <strong>{{ task.title }}</strong>
            <span v-if="!isDisplayOnlySwpCall(task)" class="alert-task__type">
              {{ typeLabel(task.type) }}
            </span>
          </div>
          <p>{{ task.description }}</p>
          <div class="alert-task__meta">
            <span v-if="task.roomName && task.canLocate !== false">{{ task.roomName }}</span>
            <span v-if="task.bedName && task.canLocate !== false">{{ formatBedLabel(task.bedName) }}</span>
            <span v-if="task.startedAt">
              {{ isDisplayOnlySwpCall(task) ? '呼叫' : '发生' }} {{ formatTaskOccurredAt(task) }}
            </span>
            <span v-if="waitingLabel(task)" class="alert-task__meta-wait">
              {{ waitingLabel(task) }}
            </span>
            <span :class="{ 'alert-task__meta-live': isDisplayOnlySwpCall(task) }">
              {{ taskStatusText(task) }}
            </span>
          </div>
          <div v-if="ackRecords[task.id] && !isDisplayOnlySwpCall(task)" class="alert-task__ack">
            <span>{{ ackRecords[task.id].operator }}</span>
            <span>{{ formatAckTime(task.id) }}</span>
            <span v-if="syncLabel(task.id)" :class="`alert-task__sync--${ackRecords[task.id].syncState}`">
              {{ syncLabel(task.id) }}
            </span>
          </div>
        </div>

        <div
          class="alert-task__actions"
          :class="{
            'alert-task__actions--empty':
              task.canLocate === false && !canMarkHandling(task),
          }"
        >
          <button
            v-if="task.canLocate !== false"
            type="button"
            class="alert-task__locate"
            @click="emit('locate', task.id)"
          >
            {{ task.actionText }}
          </button>
          <button
            v-if="canMarkHandling(task)"
            type="button"
            class="alert-task__ghost alert-task__ghost--handling"
            @click="emit('markHandling', task.id)"
          >
            {{ handlingActionText() }}
          </button>
          <span
            v-if="isDisplayOnlySwpCall(task) && task.canLocate === false"
            class="alert-task__unlocated"
          >
            <i aria-hidden="true" />
            暂无法定位
          </span>
          <span v-if="!isDisplayOnlySwpCall(task) && task.status === 'handling'" class="alert-task__recovery-tip">
            等待状态恢复后自动结束
          </span>
        </div>
      </li>
    </ul>

    <div v-if="hasExpandableTasks" class="alert-task-panel__more">
      <span v-if="overflowCount">还有 {{ overflowCount }} 项告警</span>
      <button type="button" @click="showAllTasks = !showAllTasks">
        {{ showAllTasks ? '收起任务' : '查看全部任务' }}
      </button>
    </div>

  </section>
</template>

<style scoped lang="scss">
.alert-task-panel {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid rgba(91, 210, 255, 0.22);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(26, 67, 91, 0.32), rgba(8, 20, 35, 0.76) 48%, rgba(43, 15, 30, 0.46)),
    repeating-linear-gradient(90deg, transparent 0 31px, rgba(91, 210, 255, 0.025) 32px);
  box-shadow:
    inset 0 1px 0 rgba(210, 246, 255, 0.07),
    inset 0 0 36px rgba(24, 126, 171, 0.06),
    0 14px 30px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px) saturate(1.12);
  padding-bottom: 8px;

  &::before {
    position: absolute;
    top: 0;
    right: 16px;
    width: 72px;
    height: 1px;
    content: '';
    background: linear-gradient(90deg, transparent, rgba(91, 210, 255, 0.8));
    box-shadow: 20px 5px 0 -0.25px rgba(91, 210, 255, 0.3);
    pointer-events: none;
  }

  &--compact {
    padding: 10px;
  }

  &__list {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 0 10px;
    margin: 0;
    list-style: none;
    max-height: 560px;
    box-sizing: border-box;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  &__more {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 6px 0 0;
    font-size: 11px;
    color: rgba(205, 226, 240, 0.72);

    button {
      min-height: 26px;
      padding: 0 9px;
      border: 1px solid rgba(77, 208, 255, 0.3);
      border-radius: 6px;
      color: rgba(190, 235, 255, 0.94);
      background: rgba(38, 129, 167, 0.18);
      font-family: inherit;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }
  }

  &__hidden {
    margin-top: 8px;
    color: rgba(255, 220, 165, 0.86);
    font-size: 11px;

    summary {
      cursor: pointer;
      font-weight: 800;
    }

    ul {
      display: grid;
      gap: 6px;
      padding: 8px 0 0;
      margin: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    button {
      min-height: 24px;
      border: 1px solid rgba(255, 220, 165, 0.28);
      border-radius: 6px;
      color: rgba(255, 235, 200, 0.94);
      background: rgba(170, 105, 35, 0.18);
      cursor: pointer;
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border: 1px dashed rgba(77, 208, 255, 0.2);
    border-radius: 8px;
    background: rgba(5, 16, 28, 0.28);

    strong {
      color: rgba(234, 252, 255, 0.92);
      font-size: 13px;
    }

    span {
      color: rgba(188, 215, 232, 0.72);
      font-size: 11px;
      line-height: 1.45;
    }
  }
}

.alert-task {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 82px;
  padding: 10px 10px 14px 13px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background:
    linear-gradient(104deg, rgba(15, 44, 63, 0.56), rgba(5, 16, 28, 0.54) 54%, rgba(17, 29, 44, 0.5));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.035),
    0 7px 18px rgba(0, 0, 0, 0.16);
  animation: alert-card-enter 0.42s cubic-bezier(0.2, 0.72, 0.18, 1) both;
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;

  &::after {
    position: absolute;
    right: 7px;
    bottom: 6px;
    width: 15px;
    height: 7px;
    border-right: 1px solid rgba(111, 222, 255, 0.22);
    border-bottom: 1px solid rgba(111, 222, 255, 0.22);
    content: '';
    pointer-events: none;
  }

  &--critical {
    border-color: rgba(255, 82, 82, 0.42);
    box-shadow:
      inset 3px 0 0 rgba(255, 82, 82, 0.88),
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 7px 18px rgba(0, 0, 0, 0.16);
  }

  &--high {
    border-color: rgba(255, 183, 77, 0.34);
    box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.86);
  }

  &--medium {
    border-color: rgba(77, 208, 255, 0.22);
    box-shadow: inset 3px 0 0 rgba(77, 208, 255, 0.72);
  }

  &--handling {
    background: rgba(16, 42, 55, 0.55);
  }

  &--waiting-attention {
    border-color: rgba(255, 183, 77, 0.72);
    box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.95);
  }

  &--waiting-urgent {
    border-color: rgba(255, 82, 82, 0.88);
    box-shadow: inset 3px 0 0 rgba(255, 82, 82, 1), 0 0 0 1px rgba(255, 82, 82, 0.18);
  }

  &--swp-call {
    &::before {
      position: absolute;
      z-index: 0;
      top: 50%;
      right: 72px;
      width: 106px;
      height: 106px;
      border: 1px solid rgba(96, 211, 255, 0.1);
      border-radius: 50%;
      content: '';
      box-shadow:
        0 0 0 14px rgba(96, 211, 255, 0.035),
        0 0 0 30px rgba(96, 211, 255, 0.02);
      transform: translate(50%, -50%);
      pointer-events: none;
    }

    border-color: rgba(255, 102, 102, 0.52);
    background:
      radial-gradient(circle at 12% 18%, rgba(255, 79, 101, 0.14), transparent 36%),
      linear-gradient(108deg, rgba(43, 18, 34, 0.78), rgba(8, 28, 43, 0.75) 48%, rgba(10, 47, 65, 0.7));
    box-shadow:
      inset 3px 0 0 rgba(255, 89, 105, 0.92),
      inset 0 1px 0 rgba(255, 230, 235, 0.07),
      0 0 0 1px rgba(255, 88, 105, 0.06),
      0 9px 22px rgba(0, 0, 0, 0.2);

    &::after {
      border-color: rgba(91, 210, 255, 0.46);
    }
  }

  &--swp-call.alert-task--waiting-attention {
    border-color: rgba(255, 176, 92, 0.76);
  }

  &--swp-call.alert-task--waiting-urgent {
    border-color: rgba(255, 91, 108, 0.94);
    box-shadow:
      inset 3px 0 0 #ff596d,
      inset 0 1px 0 rgba(255, 230, 235, 0.08),
      0 0 0 1px rgba(255, 89, 109, 0.14),
      0 9px 24px rgba(65, 0, 14, 0.24);
  }

  &__scan {
    position: absolute;
    z-index: 0;
    top: -40%;
    bottom: -40%;
    left: -42%;
    width: 28%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(86, 218, 255, 0.03),
      rgba(126, 230, 255, 0.13),
      transparent
    );
    filter: blur(1px);
    transform: skewX(-12deg);
    animation: alert-card-scan 4.8s ease-in-out infinite;
    pointer-events: none;
  }

  &__main {
    position: relative;
    z-index: 1;
    min-width: 0;
  }

  &__head,
  &__meta,
  &__actions {
    display: flex;
    align-items: center;
  }

  &__head {
    gap: 7px;
    min-width: 0;

    strong {
      min-width: 0;
      overflow: hidden;
      color: #fff;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__signal {
    position: relative;
    display: grid;
    width: 19px;
    height: 19px;
    flex: 0 0 19px;
    place-items: center;
    border: 1px solid rgba(255, 107, 119, 0.55);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 79, 97, 0.2), rgba(255, 79, 97, 0.03) 70%);
    box-shadow: 0 0 10px rgba(255, 69, 91, 0.18);

    &::before,
    &::after {
      position: absolute;
      inset: -1px;
      border: 1px solid rgba(255, 106, 120, 0.42);
      border-radius: inherit;
      content: '';
      animation: alert-call-ring 2.4s ease-out infinite;
      pointer-events: none;
    }

    &::after {
      animation-delay: 1.2s;
    }

    i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #ff6678;
      box-shadow: 0 0 7px rgba(255, 102, 120, 0.92);
    }
  }

  &__severity,
  &__type,
  &__meta span {
    flex-shrink: 0;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
  }

  &__severity {
    padding: 2px 6px;
    color: #fff;
    background: rgba(255, 82, 82, 0.72);
  }

  &__type {
    padding: 2px 6px;
    color: rgba(190, 235, 255, 0.92);
    background: rgba(77, 208, 255, 0.14);
  }

  p {
    margin: 5px 0 7px;
    color: rgba(220, 235, 245, 0.86);
    font-size: 12px;
    line-height: 1.45;
  }

  &__meta {
    gap: 5px;
    padding-bottom: 1px;
    flex-wrap: wrap;

    span {
      padding: 2px 6px;
      color: rgba(198, 221, 238, 0.78);
      background: rgba(255, 255, 255, 0.06);
    }

    .alert-task__meta-wait {
      color: rgba(255, 230, 176, 0.96);
      background: rgba(176, 98, 26, 0.24);
    }

    .alert-task__meta-live {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid rgba(88, 231, 199, 0.18);
      color: rgba(176, 255, 233, 0.96);
      background: rgba(26, 133, 111, 0.16);

      &::before {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        content: '';
        background: #65f0cd;
        box-shadow: 0 0 7px rgba(101, 240, 205, 0.78);
        animation: alert-call-beacon 1.8s ease-in-out infinite;
      }
    }
  }

  &__ack {
    display: flex;
    gap: 6px;
    margin-top: 6px;

    span {
      padding: 2px 6px;
      border: 1px solid rgba(118, 255, 189, 0.18);
      border-radius: 999px;
      color: rgba(189, 255, 224, 0.82);
      background: rgba(30, 120, 82, 0.14);
      font-size: 10px;
      font-weight: 800;
    }
  }

  &__actions {
    position: relative;
    z-index: 1;
    display: flex;
    width: 96px;
    min-height: 50px;
    align-items: stretch;
    justify-content: center;
    padding-left: 10px;
    border-left: 1px solid rgba(105, 211, 244, 0.13);
    align-self: center;
    flex-direction: column;
    gap: 6px;
  }

  &__actions--empty {
    align-items: center;
    border-left-color: rgba(255, 151, 111, 0.18);
  }

  &__unlocated {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 28px;
    padding: 0 7px;
    border: 1px dashed rgba(255, 184, 127, 0.32);
    border-radius: 6px;
    color: rgba(255, 218, 180, 0.88);
    background: rgba(151, 74, 38, 0.14);
    font-size: 10px;
    font-weight: 800;
    line-height: 1.2;
    text-align: center;

    i {
      width: 5px;
      height: 5px;
      flex: 0 0 5px;
      border-radius: 50%;
      background: #ffbb86;
      box-shadow: 0 0 7px rgba(255, 187, 134, 0.72);
    }
  }

  &__recovery-tip {
    max-width: 108px;
    color: rgba(183, 226, 238, 0.82);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
  }

  button {
    min-width: 58px;
    min-height: 26px;
    padding: 0 9px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  &__locate {
    width: 100%;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(77, 208, 255, 0.55);
    color: #eafcff;
    background: linear-gradient(135deg, rgba(21, 128, 183, 0.75), rgba(31, 92, 162, 0.62));
    box-shadow:
      inset 0 1px 0 rgba(226, 250, 255, 0.12),
      0 0 14px rgba(77, 208, 255, 0.1);

    &::after {
      position: absolute;
      top: 0;
      bottom: 0;
      left: -70%;
      width: 45%;
      content: '';
      background: linear-gradient(90deg, transparent, rgba(220, 250, 255, 0.22), transparent);
      transform: skewX(-18deg);
      transition: left 0.42s ease;
      pointer-events: none;
    }
  }

  &__ghost {
    border: 1px solid rgba(180, 215, 235, 0.2);
    color: rgba(216, 235, 248, 0.86);
    background: rgba(255, 255, 255, 0.06);

    &--handling {
      border-color: rgba(77, 208, 255, 0.58);
      color: #e9fbff;
      background: rgba(34, 137, 185, 0.54);
      box-shadow: 0 0 12px rgba(77, 208, 255, 0.12);
    }

    &--hide {
      border-color: rgba(255, 183, 77, 0.48);
      color: rgba(255, 225, 178, 0.94);
      background: rgba(164, 98, 28, 0.16);
    }
  }
}

@media (hover: hover) {
  .alert-task:hover {
    border-color: rgba(116, 220, 255, 0.38);
    box-shadow:
      inset 3px 0 0 rgba(93, 213, 255, 0.72),
      0 10px 24px rgba(0, 0, 0, 0.22),
      0 0 18px rgba(58, 176, 223, 0.06);
    transform: translateY(-1px);
  }

  .alert-task--swp-call:hover {
    border-color: rgba(255, 112, 125, 0.72);
    box-shadow:
      inset 3px 0 0 rgba(255, 89, 105, 0.95),
      0 10px 25px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(255, 89, 105, 0.08);
  }

  .alert-task__locate:hover::after {
    left: 125%;
  }
}

@media (max-width: 560px) {
  .alert-task {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;

    &__actions {
      width: auto;
      min-height: 0;
      align-items: stretch;
      padding: 8px 0 0;
      border-top: 1px solid rgba(105, 211, 244, 0.13);
      border-left: 0;
    }

    &__actions--empty {
      align-items: flex-start;
      border-top-color: rgba(255, 151, 111, 0.18);
    }

    &__locate {
      width: 100%;
    }
  }
}

@keyframes alert-card-enter {
  from {
    opacity: 0;
    transform: translate3d(12px, 0, 0) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes alert-card-scan {
  0%,
  52% {
    opacity: 0;
    transform: translateX(0) skewX(-12deg);
  }
  62% {
    opacity: 0.9;
  }
  88%,
  100% {
    opacity: 0;
    transform: translateX(560%) skewX(-12deg);
  }
}

@keyframes alert-call-ring {
  0% {
    opacity: 0.65;
    transform: scale(0.72);
  }
  72%,
  100% {
    opacity: 0;
    transform: scale(1.65);
  }
}

@keyframes alert-call-beacon {
  0%,
  100% {
    opacity: 0.62;
    transform: scale(0.86);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .alert-task,
  .alert-task__scan,
  .alert-task__signal::before,
  .alert-task__signal::after,
  .alert-task__meta-live::before {
    animation: none;
  }

  .alert-task {
    transition: none;
  }
}
</style>
