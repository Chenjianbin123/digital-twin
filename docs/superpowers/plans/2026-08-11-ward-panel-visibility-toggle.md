# 病房面板显示开关实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有护士站面板开关扩展到病房和病房内视图，并把开关美化后固定在场景右下角。

**Architecture:** 保留 `App.vue` 作为页面覆盖层状态的唯一所有者，将护士站专属状态改为三视图共享状态。所有信息覆盖层通过同一布尔值控制，场景和底部导航始终挂载；现有护士站 `overlaysVisible` 接口继续复用。

**Tech Stack:** Vue 3、TypeScript、SCSS、Node.js 边界测试、Vite。

## Global Constraints

- 默认显示面板，切换护士站、病房和病房内时保留状态。
- 隐藏左右信息栏、房间导航、图例、环境告警、定位告警和装饰边框。
- 保留顶部系统标题、底部主导航、3D 场景和床位交互。
- 开关位于场景右下角、底部导航上方，桌面和移动端均不得溢出或遮挡主导航。
- 不修改 Three.js 场景业务、床头屏 JSON 解析和接口链路。

---

### Task 1: 通用面板状态、右下角开关和响应式样式

**Files:**
- Modify: `src/App.vue`
- Modify: `scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

**Interfaces:**
- Consumes: `isNurseStation`、`isWard`、`isWardInterior` 和现有 `NurseStationVisualScene.overlaysVisible: boolean`。
- Produces: `panelsVisible: Ref<boolean>`，统一驱动页面覆盖层；按钮的 `aria-label` 和 `aria-pressed` 反映当前状态。

- [ ] **Step 1: 写入失败边界测试**

将现有护士站测试中的状态断言更新为通用状态，并增加三视图、信息层和右下角样式约束：

```js
assert.match(app, /const panelsVisible = ref\(true\);/);
assert.match(app, /v-if="isNurseStation \|\| isWard \|\| isWardInterior"/);
assert.match(app, /panelsVisible = !panelsVisible/);
assert.match(app, /<DashboardFrame v-if="panelsVisible"/);
assert.match(app, /<DashboardLeftPanel v-if="panelsVisible"/);
assert.match(app, /v-if="isWard && panelsVisible"/);
assert.match(app, /v-if="isWardInterior && currentWard && panelsVisible"/);
assert.match(app, /<WardLegend v-if="\(isWard \|\| isWardInterior\) && panelsVisible"/);
assert.match(app, /v-show="panelsVisible"/);
assert.match(app, /:overlays-visible="panelsVisible"/);
assert.match(app, /&__panel-toggle \{[\s\S]*?bottom: 118px;/);
assert.match(app, /&__panel-toggle-icon[\s\S]*?&::after/);
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

Expected: FAIL，提示缺少 `panelsVisible` 或右下角样式。

- [ ] **Step 3: 最小实现通用状态与控制范围**

在 `App.vue` 中：

```vue
<script setup lang="ts">
const panelsVisible = ref(true);
</script>

<button
  v-if="isNurseStation || isWard || isWardInterior"
  type="button"
  class="digital-twin__panel-toggle"
  :class="{ 'digital-twin__panel-toggle--hidden': !panelsVisible }"
  :aria-label="panelsVisible ? '隐藏所有信息面板' : '显示所有信息面板'"
  :aria-pressed="!panelsVisible"
  @click="panelsVisible = !panelsVisible"
>
  <span class="digital-twin__panel-toggle-icon" aria-hidden="true"><i /></span>
  <span>{{ panelsVisible ? '隐藏面板' : '显示面板' }}</span>
</button>
```

分别以 `panelsVisible` 控制 `DashboardFrame`、`DashboardLeftPanel`、`DashboardAreaNav`、`EnvAlertBanner`、定位告警、`WardLegend`、右侧面板及护士站覆盖层；`DashboardHeader`、`DashboardBottomNav` 和场景组件保持无条件挂载。

- [ ] **Step 4: 实现右下角响应式视觉**

```scss
.digital-twin {
  &__panel-toggle {
    position: absolute;
    right: calc(var(--scene-panel-width, 460px) + 18px);
    bottom: 118px;
    z-index: 32;
    border-radius: 7px;
  }

  &__panel-toggle-icon::after {
    content: '';
    position: absolute;
    width: 24px;
    height: 2px;
    background: currentColor;
    transform: rotate(-42deg) scaleX(0);
  }

  &__panel-toggle--hidden &__panel-toggle-icon::after {
    transform: rotate(-42deg) scaleX(1);
  }

  &__main--panels-hidden &__scene {
    right: 0;
  }
}
```

移动端把 `right` 固定为 `12px`，将 `bottom` 放在底部导航和安全区上方，并缩小按钮内边距；病房内因存在 3D/2.5D 子导航，使用额外主容器修饰类提高按钮位置。

- [ ] **Step 5: 运行聚焦测试、类型检查和构建**

Run: `node scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

Expected: PASS，输出 `Nurse-station controls and panel-toggle boundary checks passed.`

Run: `npx vue-tsc --noEmit`

Expected: exit 0。

Run: `npm run build`

Expected: exit 0；允许项目既有 Sass legacy API、`js-md5 eval` 和大 chunk 警告。

- [ ] **Step 6: 浏览器视觉验收**

在桌面和 `390×844` 移动视口分别检查病房和病房内：开关位于右下角且不与底部导航重叠；点击后目标信息层隐藏、场景扩展，按钮切换为“显示面板”；再次点击恢复。护士站既有开关行为保持一致。

- [ ] **Step 7: 提交**

当前项目不是 Git 仓库，不执行提交；交付时列明修改文件和验证结果。
