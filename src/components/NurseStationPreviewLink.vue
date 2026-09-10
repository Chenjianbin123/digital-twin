<template>
  <a
    class="station-preview-link"
    href="/nurse-station-preview.html"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="第二版模型预览（新标签页打开）"
    title="第二版模型预览（新标签页打开，演示数据）"
  >
    <span class="station-preview-link__full">第二版模型预览</span>
    <span class="station-preview-link__short" aria-hidden="true">V2 预览</span>
    <span aria-hidden="true">↗</span>
  </a>
</template>

<style scoped lang="scss">
.station-preview-link {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #729aab38;
  border-radius: 6px;
  background: #15313f;
  color: #b8dcdf;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;

  &:hover { background: #204451; border-color: #8cd0ce77; }
  &:focus-visible { outline: 2px solid #94dfd4; outline-offset: 2px; }
  &__short { display: none; }
}
@media (max-width: 1100px) {
  .station-preview-link__full { display: none; }
  .station-preview-link__short { display: inline; }
}
</style>
