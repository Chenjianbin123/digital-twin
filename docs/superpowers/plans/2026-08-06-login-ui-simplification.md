# 登录页面精简实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将登录门禁界面精简为纯中文的智慧病房数字孪生平台登录流程。

**Architecture:** 保留现有 `SwpLoginGate.vue` 的凭据登录、角色确认、错误反馈和会话逻辑，仅替换界面文案与对应布局样式。通过边界测试锁定必需中文文案和禁止英文文案，再运行构建验证。

**Tech Stack:** Vue 3、TypeScript、SCSS、Node.js 内置测试、Vite。

## Global Constraints

- 登录组件生成的界面文案全部使用简体中文，不展示英文标题或辅助说明。
- 不修改 SWP 登录接口、MD5 密码摘要、角色选择和 Token 生命周期。
- 背景护士站图片中的模型贴图文字保持不变。

### Task 1: 更新登录文案边界测试

**Files:**
- Modify: `scripts/login-gate-boundary.test.mjs`

- [ ] **Step 1: 写入文案断言**

断言组件包含“智慧病房数字孪生平台”和“登录”，并且不包含已废弃的英文、旧标题、旧按钮和品牌提示。

- [ ] **Step 2: 运行测试确认当前实现失败**

Run: `node --test scripts/login-gate-boundary.test.mjs`
Expected: FAIL，因为当前组件仍包含旧文案。

### Task 2: 精简登录界面

**Files:**
- Modify: `src/components/SwpLoginGate.vue`

- [ ] **Step 1: 删除英文品牌和辅助提示**

移除品牌标记、英文眉题、英文角色眉题、SWP 辅助说明、底部状态区；将主标题改为“智慧病房数字孪生平台”，提交按钮改为“登录”，保留必要的中文错误和加载状态。

- [ ] **Step 2: 收拢布局并清理无用样式**

删除对应的无用 SCSS，调整登录内容垂直留白，确保桌面和移动端标题、表单、按钮可见且不溢出。

- [ ] **Step 3: 运行边界测试和生产构建**

Run: `node --test scripts/login-gate-boundary.test.mjs && npm run build`
Expected: 所有测试通过，`vue-tsc` 和 Vite 构建成功。

### Task 3: 页面视觉回归

**Files:**
- No source changes expected.

- [ ] **Step 1: 启动开发服务并检查登录页**

Run: `npm run dev -- --host 127.0.0.1`

检查桌面与移动端：登录区域无英文、没有过量空白，标题与按钮不被背景或容器遮挡；角色确认页面仍显示中文角色选择和切换账号。
