# 真实接口优先数据源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让开发和生产构建默认连接 `192.168.96.104` 的真实 SWP 接口，只有显式配置 `mock` 时才加载模拟数据。

**Architecture:** 将数据源字符串解析提取为不依赖 Vite 环境的纯函数，并让现有 API 层复用；补充生产环境配置，确保构建时不会因缺少 `VITE_DATA_SOURCE` 静默进入 Mock。现有真实接口、登录 Token、轮询和本地展示降级逻辑保持不变。

**Tech Stack:** Vue 3、TypeScript、Vite、Node.js test runner

## Global Constraints

- 默认后端必须为 `192.168.96.104`。
- 只有显式 `VITE_DATA_SOURCE=mock` 才能启用模拟业务数据。
- 接口失败不得补模拟患者、床位、呼叫、状态或环境数据。
- 保留使用真实业务数据生成本地固定展示布局的模板降级能力。
- 当前目录没有 Git 元数据，因此不执行提交步骤。

---

### Task 1: 数据源默认值改为真实接口

**Files:**
- Create: `src/core/data-source.ts`
- Create: `src/core/data-source.test.ts`
- Modify: `src/api/door-device.ts:43-48`

**Interfaces:**
- Produces: `DataSource = 'mock' | 'remote' | 'database'`
- Produces: `resolveDataSource(value?: string): DataSource`
- Consumes: `import.meta.env.VITE_DATA_SOURCE`

- [ ] **Step 1: 写失败测试**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDataSource } from './data-source.ts';

test('defaults missing and invalid data-source values to remote', () => {
  assert.equal(resolveDataSource(), 'remote');
  assert.equal(resolveDataSource('invalid'), 'remote');
});

test('keeps explicitly configured data-source values', () => {
  assert.equal(resolveDataSource('remote'), 'remote');
  assert.equal(resolveDataSource('database'), 'database');
  assert.equal(resolveDataSource('mock'), 'mock');
});
```

- [ ] **Step 2: 运行测试并确认红灯**

Run: `node --experimental-strip-types --test src/core/data-source.test.ts`

Expected: FAIL，因为 `src/core/data-source.ts` 尚不存在。

- [ ] **Step 3: 实现纯数据源解析函数**

```ts
export type DataSource = 'mock' | 'remote' | 'database';

export function resolveDataSource(value?: string): DataSource {
  return value === 'mock' || value === 'database' ? value : 'remote';
}
```

- [ ] **Step 4: API 层复用解析函数**

在 `src/api/door-device.ts` 导入 `resolveDataSource` 和 `DataSource`，删除本地重复类型，并改为：

```ts
export function getDataSource(): DataSource {
  return resolveDataSource(import.meta.env.VITE_DATA_SOURCE);
}
```

- [ ] **Step 5: 运行测试并确认绿灯**

Run: `node --experimental-strip-types --test src/core/data-source.test.ts`

Expected: 2 tests pass，0 fail。

---

### Task 2: 补齐生产环境真实接口配置

**Files:**
- Create: `.env.production`
- Modify: `README.md`

**Interfaces:**
- Produces: Vite production variables `VITE_DATA_SOURCE`、`VITE_DEVICE_HOST`、`VITE_API_TOKEN`、`VITE_APK_SYSTEM_TYPE`、`VITE_MENU_MODE`

- [ ] **Step 1: 创建生产环境配置**

```env
VITE_DATA_SOURCE=remote
VITE_DEVICE_HOST=192.168.96.104
VITE_API_TOKEN=
VITE_APK_SYSTEM_TYPE=2
VITE_MENU_MODE=1
```

- [ ] **Step 2: 更新 README 的默认数据源说明**

将数据库模式描述为可选模式，并明确开发、生产默认使用：

```env
VITE_DATA_SOURCE=remote
VITE_DEVICE_HOST=192.168.96.104
```

说明 Token 来自登录接口，不写入环境文件；只有显式设置 `VITE_DATA_SOURCE=mock` 才会启用模拟数据。

- [ ] **Step 3: 验证环境配置**

Run: `rg -n "VITE_DATA_SOURCE=remote|VITE_DEVICE_HOST=192.168.96.104" .env.development .env.production README.md`

Expected: 开发和生产配置都命中 `remote` 与 `192.168.96.104`。

---

### Task 3: 全量回归验证

**Files:**
- Test: `src/core/data-source.test.ts`
- Test: `src/core/ward-corridor-model.test.ts`
- Test: `src/core/ward-corridor-camera.test.ts`
- Test: `src/core/template/door-screen-orientation.test.ts`

- [ ] **Step 1: 运行单元测试**

Run: `node --experimental-strip-types --test src/core/data-source.test.ts src/core/ward-corridor-model.test.ts src/core/ward-corridor-camera.test.ts src/core/template/door-screen-orientation.test.ts`

Expected: 所有测试通过，0 fail。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: `vue-tsc --noEmit` 与 `vite build` 均成功，退出码为 0。

- [ ] **Step 3: 检查构建产物不包含开发诊断入口**

Run: `test ! -e ward-corridor-debug.html`

Expected: 退出码为 0。
