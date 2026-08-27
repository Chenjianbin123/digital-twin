# 管理员与护士全病区读取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许超级管理员、管理员和护士角色读取并进入全部启用病区，其他角色继续按显式授权访问。

**Architecture:** 数据库鉴权服务从正式会话复核查询中取得当前角色名称，使用一个服务端白名单判断是否具备全病区权限。病区列表和单病区访问共用该判断，前端不包含角色权限逻辑。

**Tech Stack:** Node.js、MySQL 参数化 SQL、Node test runner

## Global Constraints

- 全病区角色只允许准确名称：`超级管理员`、`管理员`、`护士`。
- 不修改用户、角色和病区授权数据库记录。
- 非白名单角色继续使用 `sys_role_area_data`。
- 账号、角色或用户角色关系停用后已有会话立即失效。

---

### Task 1: 统一全病区角色权限

**Files:**
- Modify: `scripts/db-auth-service.test.mjs`
- Modify: `server/db-auth-service.mjs`

**Interfaces:**
- Consumes: `auth.verifySession(sessionToken)` 和当前用户角色数据库关系。
- Produces: `verifySession(sessionToken)` 返回包含 `roleName` 的服务端上下文；`listAuthorizedAreas` 与 `assertAreaAccess` 使用同一白名单规则。

- [ ] **Step 1: 写失败测试**

为管理员、护士和超级管理员分别断言：无 `sys_role_area_data` 记录时仍返回全部启用病区并允许进入；普通角色仍拒绝未授权病区。

- [ ] **Step 2: 验证测试失败**

Run: `node --test scripts/db-auth-service.test.mjs`

Expected: 白名单角色仍走显式授权查询，测试失败。

- [ ] **Step 3: 实现统一权限判断**

在 `server/db-auth-service.mjs` 中增加：

```js
const FULL_AREA_ROLE_NAMES = new Set(['超级管理员', '管理员', '护士']);

function hasFullAreaAccess(roleName) {
  return FULL_AREA_ROLE_NAMES.has(String(roleName || '').trim());
}
```

会话复核查询返回 `r.role_name roleName`。白名单角色的病区列表不连接 `sys_role_area_data`，进入病区时跳过显式授权查询；普通角色保持现有逻辑。

- [ ] **Step 4: 运行聚焦测试**

Run: `node --test scripts/db-auth-service.test.mjs scripts/db-adapter-auth-boundary.test.mjs`

Expected: 全部通过。

- [ ] **Step 5: 运行完整验证**

Run: `node --experimental-strip-types --test src/core/*.test.ts src/core/template/*.test.ts scripts/*.test.ts scripts/*.test.mjs`

Run: `npm run build`

Expected: 测试与构建全部通过。

- [ ] **Step 6: 重启并联调**

重启 `server/db-adapter.mjs`，使用当前管理员或护士会话重新登录，确认病区列表非空并能进入所选病区。
