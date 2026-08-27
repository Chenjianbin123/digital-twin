# Bed Terminal Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将病房床头设备重排为屏幕、控制栏和下方装饰条组成的一体式终端。

**Architecture:** 在现有 Blender 导出脚本中创建稳定的终端布局节点，正式 GLB 保持现有动态屏幕契约。前端只更新模型缓存版本。

**Tech Stack:** Blender Python、glTF/GLB、Three.js、Node.js tests、Vue 3/Vite

## Global Constraints

- 不覆盖 Blender 源文件。
- 不修改床头屏接口与 JSON 模版解析。
- 不修改床位数量和患者映射逻辑。

---

### Task 1: 锁定终端几何契约

- [ ] 验证器要求 `BedTerminalControlPanel` 和 `BedTerminalAccent` 节点存在。
- [ ] 验证屏幕、屏框和控制栏之间无重叠。
- [ ] 更新模型 URL 测试并确认旧资产失败。

### Task 2: 重排并重新导出终端

- [ ] 左移并缩小屏框。
- [ ] 根据新屏框创建动态屏幕承载面。
- [ ] 创建右侧控制栏和下方短装饰条。
- [ ] 对齐状态灯、呼叫按钮和扬声器孔。
- [ ] 重新导出临时 GLB，通过契约后替换正式资产。

### Task 3: 回归和视觉验收

- [ ] 运行模型与集成测试、类型检查和生产构建。
- [ ] 在双床房中放大检查终端屏幕、控制栏和背景墙板关系。
- [ ] 清理临时验收入口并复验正式资产。

