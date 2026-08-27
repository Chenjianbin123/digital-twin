# Smart Ward Interior Visual Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理智能病房 GLB 的静态预览叠层、重复文字、反射重影和监护仪遮挡。

**Architecture:** 在既有 Blender 导出边界内做资产清理与布局修正，前端仅更新缓存版本。动态屏幕节点契约和 JSON 模版链路保持不变。

**Tech Stack:** Blender Python、glTF/GLB、Three.js、Node.js tests、Vue 3/Vite

## Global Constraints

- 不覆盖源 `.blend`。
- 不修改接口、患者数量床位逻辑或 JSON 模版格式。
- 保留 `BedTerminalSurface` 和 `Monitor_1_Screen` 动态节点。

---

### Task 1: 锁定资产清理契约

**Files:**
- Modify: `scripts/validate_smart_ward_interior_glb.py`
- Modify: `src/core/ward-interior-model.test.ts`

- [x] 增加失败断言，要求静态屏幕预览节点和多余字体不存在，且模型 URL 使用新版本。
- [x] 运行验证确认旧资产和旧 URL 触发预期失败。

### Task 2: 清理并重新导出 GLB

**Files:**
- Modify: `scripts/export_smart_ward_interior_glb.py`
- Replace: `public/models/smart-ward-interior/smart_ward_interior.glb`

- [x] 在导出脚本中删除静态预览对象和多余字体。
- [x] 调整监护仪组件相对床位原点的缩放与位置。
- [x] 提高床头背板材质粗糙度并降低镜面反射。
- [x] 从优化版源文件重新导出 GLB，并运行 Blender 契约验证。

### Task 3: 更新缓存并完成回归验证

**Files:**
- Modify: `src/core/ward-interior-model.ts`

- [x] 更新 `WARD_INTERIOR_MODEL_URL` 版本参数。
- [x] 运行模型单元测试和集成边界测试。
- [x] 使用 mock 数据加载真实病房内页面并进行桌面、移动端截图验收。
- [x] 运行最终类型检查和生产构建。
