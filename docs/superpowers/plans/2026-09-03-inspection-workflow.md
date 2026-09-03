# 真实巡视闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入 SWP 真实巡视记录，在护士站、病区和病房详情中展示巡视状态，并让后端巡视状态变化自动生成或解除超时任务。

**Architecture:** 新增独立巡视 API、归一化领域模块和低频可见性轮询器；Store 保存当前病区巡视快照和同步状态，并将后端明确标记为超时/未巡视的记录转换为只读定位任务。页面只展示真实记录，不提供前端虚拟完成按钮；新快照恢复正常后任务自动消失。

**Tech Stack:** Vue 3、TypeScript、Pinia、Node test、SCSS

## Global Constraints

- 使用 `/swp/swpSwipeInspectionRecord/querySwpSwipeInspectionRecord`。
- 不根据前端自定义护理时限伪造超时，优先使用后端 `swipeState`。
- 巡视任务只允许定位，不能在浏览器内完成。
- 轮询只在页面可见时运行，病区切换后旧请求不能写入新病区。
- 样式沿用当前数字孪生深色科技医疗风格。

---

### Task 1: 巡视领域模型与归一化

**Files:**
- Create: `src/types/inspection.ts`
- Create: `src/core/inspection.ts`
- Test: `src/core/inspection.test.ts`

**Interfaces:**
- Produces: `normalizeInspectionRecords(records, area, now)`、`summarizeInspectionRooms(records, area)`、`collectInspectionAlertTasks(summaries, areaId)`。

- [ ] **Step 1: Write failing tests**

覆盖病房/床位匹配、最新记录覆盖旧记录、后端超时状态生成任务、正常新记录解除任务、缺少位置不猜测。

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test src/core/inspection.test.ts`
Expected: FAIL because the inspection module does not exist.

- [ ] **Step 3: Implement minimal domain logic**

以 `sickroomId`、`sickroomCode`、`bedCode` 精确匹配；按巡视时间选取每个床位最新记录；只识别后端明确的正常、临近、超时和未知状态。

- [ ] **Step 4: Run tests**

Run: `node --test src/core/inspection.test.ts`
Expected: PASS.

### Task 2: API 与安全轮询

**Files:**
- Create: `src/api/inspection.ts`
- Create: `src/core/inspection-polling-controller.ts`
- Create: `src/core/inspection-polling-controller.test.ts`
- Create: `src/services/inspection-poller.ts`

**Interfaces:**
- Consumes: `normalizeInspectionRecords`.
- Produces: `startInspectionPoller(store, intervalMs)`、`stopInspectionPoller()`。

- [ ] **Step 1: Write failing polling tests**

验证首次立即加载、防重叠、切换病区拒绝旧响应、隐藏暂停、恢复可见立即刷新。

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test src/core/inspection-polling-controller.test.ts`
Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement API and controller**

默认每 60 秒查询一次，单页最多 200 条；请求参数包含当前 `areaId`、`pageNum` 和 `pageSize`。

- [ ] **Step 4: Run tests**

Run: `node --test src/core/inspection-polling-controller.test.ts`
Expected: PASS.

### Task 3: Store 闭环

**Files:**
- Modify: `src/stores/twin-store.ts`
- Modify: `src/core/alert-workflow.ts`
- Test: `src/core/inspection.test.ts`

**Interfaces:**
- Produces: `inspectionRecords`、`inspectionRoomSummaries`、`inspectionSync`，并将巡视超时任务合并到 `alertTasks`。

- [ ] **Step 1: Add failing alert boundary**

验证巡视超时进入任务、只允许定位、后端恢复后从任务中消失。

- [ ] **Step 2: Run test and observe failure**

Run: `node --test src/core/inspection.test.ts`

- [ ] **Step 3: Wire store state and lifecycle**

远程服务启动时启动巡视轮询；停止、退出、切换病区时停止并清空；旧病区响应不能提交。

- [ ] **Step 4: Run tests**

Run: `npm test`

### Task 4: 三层页面展示

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/components/AreaInfoPanel.vue`
- Modify: `src/components/WardInfoPanel.vue`
- Modify: `src/components/AlertTaskPanel.vue`
- Test: `scripts/inspection-ui-boundary.test.mjs`

**Interfaces:**
- Consumes: `inspectionRoomSummaries`、`inspectionSync`。

- [ ] **Step 1: Write failing UI boundary test**

要求护士站有巡视总览、病房卡有巡视状态、病房详情有最近记录、巡视任务不显示处理中或完成按钮。

- [ ] **Step 2: Run test and observe failure**

Run: `node --test scripts/inspection-ui-boundary.test.mjs`

- [ ] **Step 3: Implement styled UI**

护士站显示已巡视/需关注/超时；病区卡显示最近巡视；病房详情显示最近三条真实记录；超时任务使用琥珀红色定位样式。

- [ ] **Step 4: Run UI boundary**

Run: `node --test scripts/inspection-ui-boundary.test.mjs`

### Task 5: Verification and monthly record

**Files:**
- Modify: `docs/项目详解.md`

- [ ] **Step 1: Record September delivery**

记录真实巡视数据、自动任务闭环和三层展示。

- [ ] **Step 2: Full verification**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run build`

