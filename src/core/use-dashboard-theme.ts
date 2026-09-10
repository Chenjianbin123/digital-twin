import { ref } from 'vue';
export type DashboardTheme = 'light' | 'dark';
const STORAGE_KEY = 'ward-digital-twin:dashboard-theme';
export function useDashboardTheme() {
  let initial: DashboardTheme = 'light';
  try { if (localStorage.getItem(STORAGE_KEY) === 'dark') initial = 'dark'; } catch { /* 存储不可用时仍允许本次切换。 */ }
  const theme = ref<DashboardTheme>(initial);
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY, theme.value); } catch { /* 保持当前会话的主题。 */ }
  }
  return { theme, toggleTheme };
}
