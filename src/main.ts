import { createPinia } from 'pinia';
import { createApp } from 'vue';
import './styles/global.scss';

async function start() {
  const { default: App } = await import('./App.vue');
  const app = createApp(App);
  app.use(createPinia());
  app.mount('#app');
}

void start().catch(() => {
  const root = document.getElementById('app');
  if (!root)
    return;
  const panel = document.createElement('section');
  panel.className = 'startup-error';
  panel.setAttribute('role', 'alert');
  const heading = document.createElement('h1');
  heading.textContent = '平台启动失败';
  const message = document.createElement('p');
  message.textContent = '启动失败，请刷新页面重试。';
  const retry = document.createElement('button');
  retry.textContent = '重新加载';
  retry.addEventListener('click', () => window.location.reload());
  panel.append(heading, message, retry);
  root.replaceChildren(panel);
});
