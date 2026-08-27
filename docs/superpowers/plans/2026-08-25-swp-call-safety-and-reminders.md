# SWP 呼叫安全与提醒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不承担语音接听、不写入 SWP 呼叫状态的前提下，确保活动呼叫持续可见并降低后台漏看风险。

**Architecture:** 继续以 `eventStatus=0` 的 SWP 查询结果作为活动呼叫唯一来源。活动 SWP 呼叫不接受浏览器本地处理状态，轮询控制器在后台使用更低频率，浏览器提醒服务只对新的 SWP 呼叫批次提醒一次。

**Tech Stack:** Vue 3、Pinia、TypeScript、Node test、Web Audio API、Notifications API、localStorage。

## Global Constraints

- 数字孪生平台不调用 `/device/commonDevice/saveCallEvent`。
- 活动 SWP 呼叫不提供“已查看”“本地隐藏”和“恢复显示”；旧的本地记录不再影响活动呼叫。
- 真正接听、通话和挂断继续由 C30/SIP 终端负责。
- 不新增第三方依赖。

---

### Task 1: 活动呼叫持续可见

**Files:**
- Modify: `src/core/alert-workflow.ts`
- Modify: `src/core/alert-workflow.test.ts`
- Modify: `src/core/alert-ack.ts`
- Modify: `src/core/alert-ack.test.ts`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/App.vue`

**Interfaces:**
- 2026-08-25 后续调整：活动 SWP 呼叫不再进入本地隐藏列表，旧隐藏记录会被忽略。

- [x] **Step 1:** 测试覆盖旧 `resolved` 记录仍必须显示活动呼叫。
- [x] **Step 2:** 告警工作流忽略活动 SWP 呼叫的本地处理状态。
- [x] **Step 3:** 页面和 Store 同时拦截活动 SWP 呼叫的本地完成操作。
- [x] **Step 4:** 活动呼叫只在后端不再返回时消失。

### Task 2: 后台低频刷新

**Files:**
- Modify: `src/core/swp-event-polling-controller.ts`
- Modify: `src/core/swp-event-polling-controller.test.ts`

**Interfaces:**
- Produces: foreground 15-second polling and hidden-page 60-second polling without overlapping requests.

- [x] **Step 1: Replace the pause test** with a failing test that expects background scheduling and refresh.
- [x] **Step 2: Run the test and verify RED**.
- [x] **Step 3: Implement visibility-aware intervals** and immediate foreground catch-up.
- [x] **Step 4: Run the focused test and verify GREEN**.

### Task 3: 新呼叫一次性提醒

**Files:**
- Create: `src/core/swp-call-notifier.ts`
- Create: `src/core/swp-call-notifier.test.ts`
- Create: `src/services/swp-call-notifier.ts`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Produces: `createSwpCallNotifier(...)`, `enableSwpCallAlerts()`, `setSwpCallAlertsEnabled(...)`, `notifyNewSwpCalls(...)`.

- [x] **Step 1: Write failing notifier tests** proving one notification per event ID and no alarm-only notification.
- [x] **Step 2: Run tests and verify RED**.
- [x] **Step 3: Implement browser sound/notification adapter and explicit enable/disable UI**.
- [x] **Step 4: Run focused tests and verify GREEN**.

### Task 4: 跨标签页同步与验证

**Files:**
- Modify: `src/core/alert-ack.ts`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/App.vue`
- Modify: `docs/项目详解.md`
- Create: `scripts/swp-call-safety-ui.test.mjs`

**Interfaces:**
- Produces: `reloadAlertAckRecords()` and App-level `storage` event handling.

- [x] **Step 1: Write the boundary test** for confirmation, restore UI, reminder toggle and storage synchronization.
- [x] **Step 2: Run the boundary test and verify RED**.
- [x] **Step 3: Complete wiring and monthly documentation**.
- [x] **Step 4: Run focused tests, `npm test`, `npm run typecheck`, and `npm run build`**.
