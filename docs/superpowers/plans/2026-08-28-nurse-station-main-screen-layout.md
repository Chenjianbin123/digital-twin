# 护士站顶部主屏布局优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**目标：** 让护士站模型顶部 `Screen_Main_Frame` 的主屏模板按左、中、右三个区域完整铺满显示，同时保持右侧 `Clock_Frame` 时钟屏独立。

**架构：** 主屏继续使用 `dashboard` 模板；在屏幕组内优先选择 `深蓝 / Screen_Glass` 最大显示面生成覆盖平面，避免绑定到 UI 横条子面。通过 Canvas 模板绘制三栏内容，覆盖层使用不透明材质并关闭深度测试。

**技术栈：** Vue 3、TypeScript、Three.js CanvasTexture、Node.js 内置测试。

## 全局约束

- 不修改护士站 GLB 源文件。
- 不修改右侧独立时钟屏的绑定。
- 不修改门口屏和病房走廊屏逻辑。
- 模板必须覆盖主屏真实显示面，不能使用模型内置占位横条。

### Task 1：主屏模板三栏布局

**文件：**
- 修改：`src/core/area-scene.ts` 中 `createNurseRearDashboardTexture`
- 测试：`scripts/nurse-station-main-screen-layout-boundary.test.mjs`

- [x] 写测试，要求主屏模板包含左、中、右三栏标题和三栏布局绘制。
- [x] 运行测试确认当前实现失败。
- [x] 调整 Canvas 绘制坐标，使三栏填充主屏宽度。
- [x] 运行测试、类型检查和构建。

### Task 2：增加屏幕绑定诊断日志

**文件：**
- 修改：`src/core/area-scene.ts`
- 测试：`scripts/nurse-station-display-binding-log-boundary.test.mjs`

- [x] 为每个覆盖层输出显示根节点、原始材质、覆盖层尺寸和挂载父节点。
- [x] 运行定向测试、类型检查和构建。
