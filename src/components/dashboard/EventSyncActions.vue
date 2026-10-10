<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { refreshSwpEventsDetailed } from '@/services/swp-event-poller';
import type { SwpEventSyncState } from '@/types/swp-events';

const props = defineProps<{ areaId?: number | null; supported: boolean; sync: SwpEventSyncState; retainedCount: number }>();
const busy = ref(false);
const retrySeconds = ref(0);
const feedback = ref('');
let disposed = false;
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
function waitUntil(retryAt: number) {
  clearInterval(cooldownTimer);
  const tick = () => {
    retrySeconds.value = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    if (!retrySeconds.value) clearInterval(cooldownTimer);
  };
  tick();
  if (retrySeconds.value) cooldownTimer = setInterval(tick, 1000);
}
const available = computed(() => props.supported && Number.isSafeInteger(props.areaId) && Number(props.areaId) > 0);
async function refresh() {
  if (!available.value || busy.value || retrySeconds.value || props.sync.phase === 'loading') return;
  const areaId = props.areaId!;
  busy.value = true;
  const cooldownUntil = Date.now() + 10_000;
  waitUntil(cooldownUntil);
  feedback.value = '正在更新呼叫和输液信息，请稍候。';
  try {
    const result = await refreshSwpEventsDetailed(areaId);
    if (disposed || areaId !== props.areaId) return;
    const messages = {
      ready: '记录已更新，请结合现场情况确认。',
      partial: '目前仅有部分记录，请核对现场情况后再试。',
      busy: '正在更新，请稍候。',
      backoff: '信息暂未更新，请等待倒计时结束后重试。',
      'scope-changed': '病区信息已变化，请重新获取当前病区记录。',
      unavailable: '正在准备病区信息，请稍后重试。',
      failed: '信息暂未更新，请稍后重试并核对现场情况。',
    };
    feedback.value = messages[result.status];
    waitUntil(Math.max(cooldownUntil, result.retryAt ?? 0));
  }
  catch {
    if (!disposed && areaId === props.areaId) feedback.value = '信息暂未更新，请稍后重试。';
  }
  finally { if (!disposed) busy.value = false; }
}
onBeforeUnmount(() => { disposed = true; clearInterval(cooldownTimer); });
</script>

<template>
  <div class="event-sync-actions">
    <p v-if="retainedCount">{{ retainedCount }} 项状态待确认，请核对是否仍需处理。</p>
    <button type="button" :disabled="!available || busy || retrySeconds > 0 || sync.phase === 'loading'" @click="refresh">
      {{ busy || sync.phase === 'loading' ? '正在更新…' : retrySeconds ? `${retrySeconds} 秒后可重试` : '重新获取呼叫与输液记录' }}
    </button>
    <p>重新获取不会结束事件或改变处理结果。</p>
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </div>
</template>

<style scoped>
.event-sync-actions { margin-top: 8px; line-height: 1.7; }
p { margin: 8px 0; font-size: var(--sidebar-font-caption, 14px); overflow-wrap: anywhere; }
button { max-width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--nsc-line); border-radius: 6px; color: var(--nsc-text); background: var(--nsc-inset); font: inherit; white-space: normal; cursor: pointer; }
button:disabled { opacity: .6; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--nsc-accent); outline-offset: 3px; }
button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--nsc-accent); }
</style>
