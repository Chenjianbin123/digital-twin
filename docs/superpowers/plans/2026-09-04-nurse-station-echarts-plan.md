# Nurse Station ECharts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在护士站页面的核心指标区域增加科技风 ECharts 当前指标图，不改变 3D 模型、走廊屏或病房屏。

**Architecture:** 新增独立的 `NurseStationMetricChart` Vue 组件，接收护士站已有的实时 KPI 数据，在 DOM 容器中初始化 ECharts；护士站面板只负责传入真实指标。图表仅展示当前值，避免在没有历史接口时伪造趋势数据。

**Tech Stack:** Vue 3 Composition API、TypeScript、ECharts、Vite。

## Global Constraints

- 不修改任何 GLB 模型、相机参数、3D 纹理贴图逻辑。
- 不伪造历史数据；当前版本只使用已有实时 KPI 值。
- 图表必须在容器尺寸变化时自适应。
- 无可用数值时显示“暂无可用指标”，不能抛出运行时错误。

---

### Task 1: 添加 ECharts 指标组件

**Files:**
- Create: `src/components/dashboard/NurseStationMetricChart.vue`
- Test: `scripts/nurse-station-echarts-boundary.test.mjs`

- [ ] 写测试，要求组件引入 ECharts、使用真实 KPI props、包含 resize 处理和空数据提示。
- [ ] 运行测试确认在组件不存在或逻辑缺失时失败。
- [ ] 实现组件：初始化柱状图，使用中文指标名和数值，配置暗色科技风配色；监听 props 和容器尺寸；卸载时 dispose。
- [ ] 运行测试确认通过。

### Task 2: 接入护士站核心指标

**Files:**
- Modify: `src/components/NurseStationPanel.vue`
- Test: `scripts/nurse-station-echarts-boundary.test.mjs`

- [ ] 写测试，要求护士站面板引入组件并传入 `stationKpis`。
- [ ] 运行测试确认失败。
- [ ] 在 KPI 卡片后增加 `NurseStationMetricChart` 区域，保持现有卡片和其它面板不变。
- [ ] 运行测试确认通过。

### Task 3: 安装依赖并验证

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`（若 npm install 更新）

- [ ] 添加 `echarts` 运行依赖。
- [ ] 运行护士站边界测试和 ECharts 边界测试。
- [ ] 运行 `npx vite build` 和 `git diff --check`。
- [ ] 检查构建输出无 TypeScript 或模板错误。
