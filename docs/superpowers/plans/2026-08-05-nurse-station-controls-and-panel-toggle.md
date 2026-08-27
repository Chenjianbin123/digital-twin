# Nurse Station Controls and Panel Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为正式护士站开放受限的旋转与缩放，并增加一键隐藏/显示信息面板的明显按钮。

**Architecture:** `AreaScene` 负责 OrbitControls 的边界和复位；`App.vue` 持有护士站面板显隐状态；`NurseStationVisualScene` 根据 prop 隐藏场景浮层并允许画布接收指针事件。顶部栏、底部导航、开关按钮和复位按钮始终保留。

**Tech Stack:** Vue 3、TypeScript、Three.js OrbitControls、SCSS、Node.js assertions、Vite、Codex in-app browser。

## Global Constraints

- 仅修改护士站阶段的交互，不改变走廊和病房内视角。
- 水平旋转范围为左右 `30°`。
- 缩放距离限制为 `3.8–7.2`。
- 禁止平移，并限制相机不穿过顶棚和地面。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 开放护士站受限旋转与缩放

**Files:**
- Modify: `src/core/area-scene.ts`
- Modify: `src/components/NurseStationVisualScene.vue`
- Create: `scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

- [x] **Step 1:** 写入边界测试并确认因缺少新常量和交互配置而失败。
- [x] **Step 2:** 增加 `STATION_MIN_DISTANCE = 3.8`、`STATION_MAX_DISTANCE = 7.2`、`STATION_AZIMUTH_LIMIT = Math.PI / 6`。
- [x] **Step 3:** 在 `applyStationDeskCamera()` 开启旋转和缩放、关闭平移，并应用水平、垂直、缩放边界。
- [x] **Step 4:** 增加地面高度硬限制，保留现有顶棚限制和复位视角。
- [x] **Step 5:** 允许护士站画布接收指针事件并显示复位按钮。

### Task 2: 增加面板总开关

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/NurseStationVisualScene.vue`

- [x] **Step 1:** 在 `App.vue` 增加 `stationPanelsVisible` 状态和常驻开关按钮。
- [x] **Step 2:** 隐藏时移除 DashboardFrame、左侧信息、右侧数据面板以及护士站场景浮层。
- [x] **Step 3:** 为按钮增加高对比青绿色样式、眼睛状态图形、焦点态和移动端位置。
- [x] **Step 4:** 运行边界测试和 `npm run build`。
- [x] **Step 5:** 浏览器验证旋转、缩放、复位和面板显隐，检查桌面与移动端布局及控制台。

