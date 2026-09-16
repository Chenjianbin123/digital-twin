<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatAlertWaitingTime, type AlertTask } from '@/core/alert-workflow';
import { canLocateRoomCall, roomCallDataStatus } from '@/core/ward-call-list';
import { wardDataNotice } from '@/core/ward-presentation';
import type { TwinWardEntity } from '@/types/twin';
import type { SwpEventSyncState } from '@/types/swp-events';
const props = defineProps<{ ward: TwinWardEntity; tasks: AlertTask[]; sync?: SwpEventSyncState }>();
defineEmits<{ locate: [taskId: string] }>();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 15_000); });
onUnmounted(() => clearInterval(timer));
const status = computed(() => roomCallDataStatus(props.sync, now.value));
function timeLabel(value?: string | null) {
  const date = new Date(value?.replace(' ', 'T') ?? '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '未提供有效时间';
}
function duration(task: AlertTask) {
  // Without a response identity, elapsed time cannot be described as time without nursing attention.
  return formatAlertWaitingTime(task.startedAt, new Date(now.value)).replace('已等待', '距发生') || '发生时间待同步';
}
</script>
<template>
  <section class="ward-call-list" aria-label="本病房呼叫系统记录">
    <header><strong>呼叫系统 · 本病房</strong><span>{{ tasks.length }} 条记录</span></header>
    <p v-if="status !== 'ready'" role="status">{{ wardDataNotice(status) }}；当前呼叫状态待核对。</p>
    <p v-else-if="!tasks.length">最近一次同步未发现本病房活动呼叫。</p>
    <p v-if="sync?.lastSyncedAt" class="ward-call-list__time">呼叫源最近成功同步：{{ timeLabel(sync.lastSyncedAt) }}</p>
    <ul v-if="tasks.length">
      <li v-for="task in tasks" :key="task.id">
        <div><strong>{{ task.bedName || '床位待匹配' }}</strong><span>{{ status === 'ready' ? '来源仍报告呼叫' : '上次呼叫记录' }}</span></div>
        <small>发生：{{ timeLabel(task.startedAt) }} · {{ duration(task) }}</small>
        <button type="button" :disabled="!canLocateRoomCall(task, ward)" @click="$emit('locate', task.id)">定位床位</button>
        <small v-if="!canLocateRoomCall(task, ward)">床位无法唯一匹配，请核对设备绑定。</small>
      </li>
    </ul>
    <p v-if="tasks.length" class="ward-call-list__note">解除以呼叫来源系统为准。当前接口未提供可绑定的接手记录，不能据此判断是否已有护士处理。</p>
  </section>
</template>
<style scoped lang="scss">
.ward-call-list {
  padding: 12px; margin-bottom: 14px; border: 1px solid var(--room-line, #456271); border-radius: 8px;
  background: var(--room-inset, #153443); color: var(--room-ink, #dcebf2);
  header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
  p, small { font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
  p { margin: 8px 0 0; }
  ul { list-style: none; padding: 0; margin: 8px 0 0; max-height: 240px; overflow: auto; }
  li { display: grid; gap: 6px; padding: 10px 0; border-top: 1px solid var(--room-line, #456271); }
  li > div { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  li > div span { font-size: 12px; color: var(--room-alert, #ff9cb7); }
  button { justify-self: start; min-height: 40px; padding: 6px 12px; color: var(--room-accent, #81dce0); background: transparent; border: 1px solid var(--room-line, #456271); border-radius: 5px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  button:focus-visible { outline: 2px solid var(--room-accent, #81dce0); outline-offset: 2px; }
  &__note, &__time { color: var(--room-muted, #a6c0cd); }
}
</style>
