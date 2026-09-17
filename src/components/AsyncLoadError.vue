<script setup lang="ts">
function reload() { window.location.reload(); }
</script>

<template>
  <section class="async-load-error" role="alert">
    <strong>页面资源加载失败</strong>
    <p>请检查网络后刷新页面，重新获取页面资源。</p>
    <div>
      <button type="button" @click="reload">刷新页面</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.async-load-error {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  width: min(100%, 440px);
  margin: 24px auto;
  padding: 20px;
  border: 1px solid var(--async-error-border, #4a697b);
  border-radius: 10px;
  background: var(--async-error-surface, #102630);
  color: var(--async-error-ink, #ecf6fa);
  font-size: 14px;
  p { line-height: 1.6; }
  div { display: flex; gap: 12px; flex-wrap: wrap; }
  button { min-height: 40px; padding: 8px 12px; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 6px; cursor: pointer; }
  button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
}
:global([data-theme='light']) .async-load-error {
  --async-error-border: #c1d6df;
  --async-error-surface: #fff;
  --async-error-ink: #294c59;
}
</style>
