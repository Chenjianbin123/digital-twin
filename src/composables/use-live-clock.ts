import { computed, onMounted, onUnmounted, ref } from 'vue';

export function useLiveClock() {
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date();
    }, 1000);
  });

  onUnmounted(() => {
    if (timer)
      clearInterval(timer);
  });

  const timeText = computed(() =>
    now.value.toLocaleTimeString('zh-CN', { hour12: false }),
  );

  const dateText = computed(() =>
    now.value.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }),
  );

  return { now, timeText, dateText };
}
