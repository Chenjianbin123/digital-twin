# Mock Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让开发环境使用项目现有本地模拟数据，并在重启后可直接浏览。

**Architecture:** 通过 Vite 已有的 `VITE_DATA_SOURCE` 开关选择 `mock` 分支，复用现有 Mock 数据和模拟推送服务。业务组件、远程接口与数据库适配逻辑保持不变。

**Tech Stack:** Vite 5、Vue 3、TypeScript、Node.js

## Global Constraints

- 不修改现有模拟数据内容。
- 不搭建 HTTP Mock Server。
- 不修改远程接口和数据库适配逻辑。
- 当前目录不是 Git 仓库，因此跳过提交步骤。

---

### Task 1: 切换开发环境数据源

**Files:**
- Create: `scripts/mock-data-source-config.test.mjs`
- Modify: `.env.development:5`

**Interfaces:**
- Consumes: Vite 的 `VITE_DATA_SOURCE` 环境变量，以及 `src/api/door-device.ts` 已有的 `getDataSource()` 分支。
- Produces: 开发环境固定选择现有 `mock` 数据源。

- [ ] **Step 1: 写入失败检查**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.development', import.meta.url), 'utf8');
assert.match(env, /^VITE_DATA_SOURCE=mock$/m, '开发环境应使用 mock 数据源');
```

- [ ] **Step 2: 验证检查先失败**

Run: `node scripts/mock-data-source-config.test.mjs`

Expected: FAIL，提示“开发环境应使用 mock 数据源”。

- [ ] **Step 3: 最小修改配置**

```dotenv
VITE_DATA_SOURCE=mock
```

- [ ] **Step 4: 验证检查通过**

Run: `node scripts/mock-data-source-config.test.mjs`

Expected: PASS，退出码为 0。

- [ ] **Step 5: 验证构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建通过。

### Task 2: 重启并视觉验证

**Files:**
- Modify: none

**Interfaces:**
- Consumes: Task 1 的 `.env.development` 配置。
- Produces: 运行于 `http://127.0.0.1:5173/` 的 Mock 数据页面。

- [ ] **Step 1: 重启 Vite 开发服务器**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出本地访问地址 `http://127.0.0.1:5173/`。

- [ ] **Step 2: 浏览器验收**

打开 `http://127.0.0.1:5173/`，确认页面能加载护士站、顶部显示“模拟数据”，并出现“模拟推送”入口。

### Task 3: 修复本地数据启动链

**Files:**
- Modify: `src/core/area-selection-bootstrap.ts`
- Modify: `src/App.vue`
- Test: `scripts/area-selection-bootstrap.test.ts`

**Interfaces:**
- Consumes: `useRemoteDeviceApi` 数据源判断和 Pinia store 的 `loadArea()`。
- Produces: Mock/数据库模式直接加载本地病区，远程模式继续加载病区选择列表。

- [ ] **Step 1: 添加本地启动失败测试**

Run: `node scripts/area-selection-bootstrap.test.ts`

Expected: FAIL，本地模式仍记录 `areas` 而不是 `local`。

- [ ] **Step 2: 在启动协调器中分流数据源**

为 `AreaSelectionBootstrapOptions` 增加 `loadLocalArea(): Promise<string | null>`；非远程模式在进度 58 调用并直接返回结果，远程模式保持原流程。

- [ ] **Step 3: 从 App 接入 store 本地加载**

调用 `store.loadArea()`，Mock 加载成功后启动模拟推送，并返回 `store.error`。

- [ ] **Step 4: 运行测试、构建和浏览器验收**

Run: `node scripts/area-selection-bootstrap.test.ts && npm run build`

Expected: 测试与构建通过；浏览器显示护士站、“模拟数据”和“模拟推送”。
