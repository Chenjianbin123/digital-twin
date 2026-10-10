<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildAssistantDemoReply, type AssistantTarget } from '@/core/ai-assistant-demo';

const props = defineProps<{
  open: boolean;
  theme: 'dark' | 'light';
  scope: string;
  context: string;
  targets: AssistantTarget[];
  pendingCount: number;
  notice?: string;
}>();
const emit = defineEmits<{
  close: [];
  locate: [target: AssistantTarget];
  details: [target: AssistantTarget];
}>();
interface Message { id: number; role: 'user' | 'assistant'; text: string; targets: AssistantTarget[] }
const messages = ref<Message[]>([]);
const draft = ref('');
const busy = ref(false);
const error = ref('');
const lastQuestion = ref('');
const input = ref<HTMLTextAreaElement>();
const body = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const mobile = ref(false);
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let media: MediaQueryList | undefined;
const canSend = computed(() => !!draft.value.trim() && !busy.value);
const lastReply = computed(() => {
  const message = messages.value[messages.value.length - 1];
  return message?.role === 'assistant' ? message.text : '';
});
const shortcuts = ['总结当前病区', '查看未处理呼叫', '查找床位'];

function cancel() {
  clearTimeout(timer);
  timer = undefined;
  busy.value = false;
}
function stop() {
  cancel();
  messages.value.push({ id: ++sequence, role: 'assistant', text: '已停止，可重新输入问题。', targets: [] });
}
function reset() {
  cancel();
  messages.value = [];
  draft.value = '';
  error.value = '';
  lastQuestion.value = '';
}
function send(question = draft.value, preview: 'normal' | 'empty' | 'failure' = 'normal') {
  if (busy.value || !question.trim()) return;
  const query = question.trim().slice(0, 500);
  const snapshot = props.targets.map(target => ({ ...target }));
  const scope = props.scope;
  messages.value.push({ id: ++sequence, role: 'user', text: query, targets: [] });
  draft.value = '';
  error.value = '';
  lastQuestion.value = query;
  busy.value = true;
  // A short cancellable delay previews loading without contacting any model or hospital API.
  timer = setTimeout(() => {
    timer = undefined;
    busy.value = false;
    if (scope !== props.scope) return;
    if (preview === 'failure') {
      error.value = '查询未完成，请点击重试。';
      return;
    }
    const reply = buildAssistantDemoReply(query, preview === 'empty' ? [] : snapshot);
    messages.value.push({ id: ++sequence, role: 'assistant', ...reply });
  }, 650);
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.stopPropagation(); emit('close'); }
  if (event.key !== 'Tab' || !mobile.value || !panel.value) return;
  const items = Array.from(panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, summary'));
  const first = items[0], last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function inputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (canSend.value) send();
  }
}
function updateMobile() { mobile.value = media?.matches ?? false; }
watch(() => props.scope, reset, { flush: 'sync' });
watch(() => props.open, async open => {
  if (!open) { cancel(); return; }
  await nextTick();
  input.value?.focus({ preventScroll: true });
});
watch([() => messages.value.length, busy, error], async () => {
  await nextTick();
  if (body.value) body.value.scrollTop = body.value.scrollHeight;
});
onMounted(() => {
  media = window.matchMedia('(max-width: 1023px)');
  updateMobile();
  media.addEventListener('change', updateMobile);
  if (props.open) input.value?.focus();
});
onBeforeUnmount(() => { cancel(); media?.removeEventListener('change', updateMobile); });
</script>

<template>
  <section v-show="open" id="ai-assistant-panel" ref="panel" class="ai-assistant" :data-assistant-theme="theme"
    :role="mobile ? 'dialog' : 'region'" :aria-modal="mobile ? true : undefined"
    aria-labelledby="ai-assistant-title" @keydown="keydown">
    <header class="ai-assistant__header">
      <div class="ai-assistant__tabs">
        <button type="button" @click="emit('close')">业务信息</button>
        <h2 id="ai-assistant-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 5v10l-8 5-8-5V7Z"/><path d="M8 9h8v6H8zM10 6v3m4-3v3m-4 6v3m4-3v3M5 11h3m8 0h3"/></svg>AI 助手</h2>
      </div>
      <button type="button" class="ai-assistant__close" aria-label="关闭 AI 助手" @click="emit('close')">✕</button>
    </header>
    <button type="button" class="ai-assistant__alerts" @click="emit('close')">
      <span>业务待处理事件 <strong>{{ pendingCount }}</strong> 项</span><span>查看业务信息 →</span>
    </button>
    <div class="ai-assistant__context"><span>当前范围</span><strong>{{ context }}</strong></div>
    <p class="ai-assistant__demo">尚未接入 AI，当前支持场景床位查询与定位。</p>
    <p v-if="notice" class="ai-assistant__demo" role="alert">{{ notice }}</p>
    <div class="ai-assistant__shortcuts" aria-label="快捷提问">
      <button v-for="(question, index) in shortcuts" :key="question" type="button" :disabled="busy" @click="send(question)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="index === 0" d="M4 20h16M6 16V9m6 7V4m6 12v-6"/><path v-else-if="index === 1" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/><path v-else d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/></svg>
        {{ question }}
      </button>
    </div>
    <div ref="body" class="ai-assistant__body" :aria-busy="busy">
      <div v-if="!messages.length" class="ai-assistant__welcome">
        <div class="ai-assistant__welcome-icon" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle class="ai-assistant__orbit" cx="60" cy="60" r="53"/><g class="ai-assistant__orbit-motion"><path class="ai-assistant__orbit-segment" d="M60 7a53 53 0 0 1 46 27M14 87a53 53 0 0 0 46 26"/><circle cx="106" cy="34" r="3"/><circle cx="14" cy="87" r="3"/></g><path class="ai-assistant__chip" d="m60 25 30 17v36L60 95 30 78V42Z"/><rect x="45" y="45" width="30" height="30" rx="5"/><path d="M53 37v8m14-8v8M53 75v8m14-8v8M37 53h8m-8 14h8m30-14h8m-8 14h8M53 60h14m-7-7v14"/></svg>
        </div>
        <h3>从病区问题开始</h3>
        <p>选择上方快捷问题，体验结果卡片与三维床位定位。</p>
        <p>也可输入房间名称或床位编码。</p>
        <div class="ai-assistant__capabilities" aria-hidden="true"><span>病区概况</span><i /> <span>事件查询</span><i /> <span>场景定位</span></div>
      </div>
      <article v-for="message in messages" :key="message.id" class="ai-assistant__message" :class="`ai-assistant__message--${message.role}`">
        <span class="ai-assistant__speaker">{{ message.role === 'user' ? '我的提问' : '助手' }}</span>
        <p>{{ message.text }}</p>
        <div v-for="target in message.targets" :key="`${target.roomCode}:${target.bedCode}`" class="ai-assistant__card">
          <strong>{{ target.roomName }} · {{ target.bedName }}</strong>
          <span class="ai-assistant__card-note">床位定位</span>
          <div class="ai-assistant__card-actions">
            <button type="button" @click="emit('locate', target)"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>定位床位</button>
            <button type="button" @click="emit('details', target)"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4"/></svg>查看详情</button>
          </div>
        </div>
      </article>
      <p v-if="busy" class="ai-assistant__loading" role="status"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-8-8"/></svg>正在查询…</p>
      <div v-if="error" class="ai-assistant__error" role="alert">
        <p>{{ error }}</p><button type="button" @click="send(lastQuestion)"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 5v6h-6M20 11a8 8 0 1 0-2 7"/></svg>重试</button>
      </div>
      <span class="ai-assistant__sr" role="status">{{ busy ? '正在查询' : error || lastReply }}</span>
    </div>
    <footer class="ai-assistant__footer">
      <details class="ai-assistant__preview">
        <summary>状态预览</summary>
        <div><button type="button" :disabled="busy" @click="send('查找床位', 'empty')">空结果</button><button type="button" :disabled="busy" @click="send('查看未处理呼叫', 'failure')">查询失败</button><button type="button" :disabled="busy" @click="reset">清空对话</button></div>
      </details>
      <form class="ai-assistant__composer" @submit.prevent="send()">
        <label class="ai-assistant__sr" for="ai-assistant-input">询问病区情况或查找床位</label>
        <textarea id="ai-assistant-input" ref="input" v-model="draft" maxlength="500" rows="2"
          placeholder="询问病区情况或查找床位…" @keydown="inputKeydown" />
        <div><small>{{ draft.length }}/500 · Enter 发送</small>
          <button v-if="busy" type="button" @click="stop"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>停止</button>
          <button v-else type="submit" :disabled="!canSend"><svg class="ai-assistant__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14"/></svg>发送</button>
        </div>
      </form>
    </footer>
  </section>
</template>

<style scoped lang="scss" src="@/styles/ai-assistant.scss"></style>
