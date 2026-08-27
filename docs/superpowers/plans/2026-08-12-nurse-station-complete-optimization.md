# 护士站场景完整优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成护士站交互、信息架构、3D 表现、错误反馈及模型资源优化。

**Architecture:** 保留 `AreaScene` 负责 Three.js 场景和 GLB 生命周期，Vue 组件负责业务交互与可访问界面。派生指标抽到纯函数模块测试，加载状态由 `AreaScene` 通过回调上报。

**Tech Stack:** Vue 3、TypeScript、Three.js、Node test、Vite、Blender/glTF。

## Global Constraints

- 不修改远端接口协议、JSON 模版解析和病房患者数据逻辑。
- 保留高保真 GLB 与程序化模型回退。
- 不修改 Blender 源文件，资源优化只作用于项目 GLB。
- 所有行为变更先写失败测试，再实现并验证。

---

### Task 1: 交互闭环和重复入口

**Files:**
- Modify: `src/components/NurseStationVisualScene.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/App.vue`
- Test: `scripts/nurse-station-complete-optimization.test.mjs`

- [ ] 写边界测试，要求事件转发、重点病房按钮语义及重复入口移除。
- [ ] 运行测试确认因行为缺失失败。
- [ ] 实现事件转发和唯一导航入口。
- [ ] 运行测试确认通过。

### Task 2: 指标与信息层级

**Files:**
- Create: `src/core/nurse-station-metrics.ts`
- Create: `src/core/nurse-station-metrics.test.ts`
- Modify: `src/components/NurseStationPanel.vue`

- [ ] 写纯函数测试，覆盖正常、关注、紧急与设备在线口径。
- [ ] 运行测试确认模块缺失失败。
- [ ] 实现纯函数并接入护士站面板。
- [ ] 将次要信息放入原生可访问折叠区。
- [ ] 运行测试确认通过。

### Task 3: 场景加载状态与构图

**Files:**
- Modify: `src/core/area-scene.ts`
- Modify: `src/components/AreaScene3D.vue`
- Modify: `src/components/NurseStationVisualScene.vue`
- Test: `scripts/nurse-station-complete-optimization.test.mjs`

- [ ] 写边界测试覆盖加载状态回调、相机参数和弱化遮罩。
- [ ] 运行测试确认失败。
- [ ] 增加 loading/ready/fallback 状态回调并展示非阻塞提示。
- [ ] 调整相机、材质反射、遮罩和布局偏移。
- [ ] 运行测试确认通过。

### Task 4: GLB 压缩与最终验收

**Files:**
- Modify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`
- Modify: `src/core/area-scene.ts`

- [ ] 检查可用 glTF 优化工具和现有模型契约。
- [ ] 输出临时候选并验证节点契约、尺寸和文件体积。
- [ ] 替换正式 GLB 并更新缓存版本。
- [ ] 运行全部相关测试、类型检查和生产构建。
- [ ] 在桌面与移动端执行浏览器视觉验收。
