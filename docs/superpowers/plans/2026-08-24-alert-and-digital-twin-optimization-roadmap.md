# 告警与数字孪生平台优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 每个任务都必须先补失败测试，再实现代码，最后运行该任务和全量验证。

**Goal:** 按真实护士站使用流程，逐步完善 SWP 呼叫/报警的数据可靠性、请求频率、处理闭环和数字孪生联动。

**Architecture:** 保持现有 `api → core → Pinia store → Vue/Three.js` 分层。接口字段先在 `types` 和 `core` 中归一化，轮询由 controller 统一控制，页面只消费 `AlertTask` 和 `NormalizedSwpEvent`。没有确认后端协议前，不从展示文本猜测房间或床位，也不擅自修改 SWP 事件状态。

**Tech Stack:** Vue 3、Pinia、TypeScript、Vite、Three.js、Node test runner。

## Global Constraints

- 不扫描或修改 `node_modules`、`dist` 和构建产物。
- 不把 Token、密码或 `.env` 内容写入代码、测试或文档。
- 真实活动事件仍以 SWP 返回的 `eventStatus=0` 为准，不按前端时间强行删除。
- 定位只允许使用标准编码或与现有编码完全相等的字段值，不解析 `callFrom`、`callMessage` 等自由文本。
- 每个任务完成后必须运行相关测试、`npm run typecheck` 和 `npm run build`。

## 当前已完成

- 活动呼叫和输液报警接入、事件归一化、跨区域过滤和稳定事件 ID。
- 呼叫/报警任务合并、定位诊断和房间/床位跳转；活动 SWP 呼叫不允许本地隐藏。
- 同级任务按发生时间排序，任务卡显示等待时长，每 30 秒更新一次。
- 旧的本地处理记录不会影响活动 SWP 呼叫展示。
- `callFrom` 仅在完全匹配已有房间、床位或设备编码时作为兼容定位字段。
- 轮询控制器已支持页面可见性暂停/恢复，隐藏页面不持续请求，恢复时只补刷一次。
- 172 项测试通过，类型检查和生产构建通过。

## 实施顺序

### Task 1: 控制 `querySwpCallInfo` 请求频率 ✅

**优先级:** P0，直接解决接口频繁调用问题。

**Files:**
- Modify: `src/core/swp-event-polling-controller.ts`
- Modify: `src/services/swp-event-poller.ts`
- Modify: `src/core/swp-event-polling-controller.test.ts`
- Modify: `src/core/swp-event-query.test.ts`

**步骤与验收:**

- [x] 增加页面不可见时暂停策略，页面重新可见后只补刷一次。
- [x] 保留现有重入锁，确保上一次请求未结束时不会发起下一次同类请求。
- [x] 事件轮询和响应时效轮询使用独立周期与独立可见性控制，未合并重复查询。
- [x] 测试验证：隐藏页面不请求；恢复页面只刷新一次；旧病区响应不能写入新病区；原有并发测试继续通过。
- [x] 验收结果：事件默认轮询仍为 15 秒，响应指标仍为 60 秒；隐藏页面取消定时器，恢复页面重新建立定时器并触发一次刷新。

### Task 2: 建立定位字段适配和诊断 ✅

**优先级:** P0，解决“定位字段缺失”和“编码未匹配”。

**Files:**
- Modify: `src/types/swp-events.ts`
- Modify: `src/core/swp-event-normalizer.ts`
- Modify: `src/core/swp-event-normalizer.test.ts`
- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `scripts/swp-alert-diagnostics-ui.test.mjs`

**步骤与验收:**

- [x] 保留标准字段 `sickroomId`、`sickroomCode`、`bedCode`、`deviceCode` 的定位能力；来源优先记录稳定病房 ID，其次是床位/设备编码，最后是病房编码。
- [ ] 对 SWP 已确认存在的等价字段做显式别名归一化；每个别名必须有测试，不能使用任意 `Object.values()` 猜字段。
- [x] 在归一化事件中记录使用的定位来源字段，页面显示“接口字段定位”或“呼叫源编码定位”。
- [x] 对字段为空、字段有值但不匹配、多个位置同时匹配分别保留不同诊断状态。
- [x] 测试验证：标准字段匹配、`callFrom` 完全匹配、自然语言文本不匹配、冲突字段不定位。
- [x] 等价字段别名暂不增加：当前掌握的 SWP 返回结构没有确认可安全映射的别名，待后端提供样例后再补。

**验收结果：** 归一化事件保留 `locationSource`；标准接口字段显示“接口字段定位”，仅在标准字段为空且 `callFrom` 完全匹配已有房间、床位或设备编码时显示“呼叫源编码定位”；自由文本不会参与猜测。

### Task 3: 接入真实处理闭环，保留本地降级 ✅

**优先级:** P0，避免护士处理后任务仍被后端反复返回。

**Files:**
- Inspect/Modify: `src/api/alert-ack.ts`
- Modify: `src/core/alert-ack.ts`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `scripts/alert-closure-boundary.test.mjs`

**步骤与验收:**

- [x] 已从安卓管理机源码确认呼叫接听依赖管理机或 SIP 终端，数字孪生页面只展示真实 SWP 活动呼叫。
- [x] 移除 `/device/commonDevice/saveCallEvent` 接听登记，页面不再伪造 `eventStatus=1` 或通话开始时间。
- [x] SWP 呼叫页面只提供定位并始终显示“呼叫中”；不允许本地隐藏，真正接听由管理机或话机完成。
- [x] 呼叫卡明确提示用户前往护士站管理机或话机完成真正接听。

**验收结果：** 数字孪生页面不承担语音接听职责，不调用呼叫事件写接口；活动呼叫由后端 `eventStatus=0` 决定，真正接听、通话和挂断由 C30/SIP 终端负责。

### Task 4: 完善事件生命周期和重复呼叫规则 ✅

**优先级:** P1，符合“超过几分钟消失、重新呼叫重新出现”的临床场景。

**Files:**
- Modify: `src/core/alert-workflow.ts`
- Modify: `src/core/alert-workflow.test.ts`
- Modify: `src/core/swp-event-normalizer.ts`
- Modify: `src/core/swp-event-normalizer.test.ts`

**步骤与验收:**

- [x] 以 `eventId/id/callId + callStartTime` 区分事件发生批次。
- [x] 同一床位的新发生时间生成新的可处理任务，即使后端复用记录 ID。
- [x] 后端返回非活动状态后，下一次快照移除任务；不靠前端等待时间自动移除。
- [x] 同一快照内重复记录只保留一条；不同发生批次不会被错误合并。
- [x] 测试覆盖：重复记录、同 ID 新时间、状态从活动变结束、跨病区记录和缺少 ID 的指纹事件。

**验收结果：** 事件 ID 对有来源 ID 的记录追加发生时间指纹；旧的本地处理记录不影响活动呼叫，后端非活动状态是移除任务的唯一依据。

### Task 5: 完善护士站任务排序和升级提示 ✅

**优先级:** P1，帮助护士先处理最需要关注的任务。

**Files:**
- Modify: `src/core/alert-workflow.ts`
- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/core/alert-workflow.test.ts`
- Modify: `scripts/swp-alert-diagnostics-ui.test.mjs`

**步骤与验收:**

- [x] 保留严重级别优先，再按等待时长从长到短排序。
- [x] 为呼叫设置等待时长分级提示，超过 5 分钟进入关注色，超过 10 分钟进入紧急提示；阈值集中定义在 `alert-workflow.ts`。
- [x] “处理中”任务仍保留在列表中，但不会压过新的未处理同级紧急呼叫。
- [x] 护士站呼叫 KPI 与任务列表使用同一份 `alertTasks` 过滤结果。
- [x] 测试覆盖：同级排序、等待阈值、处理中排序、新旧呼叫混合列表。

**验收结果：** 175 项测试通过，类型检查和生产构建通过。

### Task 6: 增加实时数据健康状态 ✅

**优先级:** P1，明确护士看到的是真实数据、模拟数据还是异常旧数据。

**Files:**
- Modify: `src/core/data-status.ts`
- Modify: `src/components/EnvAlertBanner.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/core/data-status.test.ts`
- Modify: `scripts/data-status-boundary.test.mjs`

**步骤与验收:**

- [x] 顶部显示数据源：真实 SWP、数据库适配器或模拟数据。
- [x] 顶部和护士站事件卡显示最近同步时间、当前错误或部分成功状态。
- [x] 呼叫接口失败但报警接口成功时进入“事件部分同步”，不会显示“事件已同步”。
- [x] 数据超过 5 分钟未刷新进入“已过期”，恢复成功后自动回到“已同步”。

**验收结果：** 现有 `data-status`、SWP 事件同步状态和响应指标同步状态已覆盖真实/数据库/模拟、加载、部分成功、失败和过期场景；本轮检查无需重复改动代码。

### Task 7: 强化任务到 3D 场景的联动 ✅

**优先级:** P2，提升护士定位效率。

**Files:**
- Modify: `src/stores/twin-store.ts`
- Modify: `src/components/AreaScene3D.vue`
- Modify: `src/components/WardScene3D.vue`
- Modify: `src/core/area-scene.ts`
- Modify: `src/core/ward-scene.ts`
- Add/Modify tests under `src/core/*scene*.test.ts`

**步骤与验收:**

- [x] 从任务卡进入床位后，3D 场景自动聚焦房间和床位。
- [x] 目标床位保持 8 秒高亮，退出房间、手动选床或处理完成后清除高亮。
- [x] 无定位任务只能停留在护士站，不会把病区名称误当成房间。
- [x] 场景加载或切换期间继续使用现有病区请求保护，不会让旧房间数据覆盖新病区。

**验收结果：** 任务定位沿用 `openAlertTask → enterRoom → selectedBedCode → WardScene.setSelectedBedCode` 链路，并增加可过期的任务高亮状态。

### Task 8: 补充真实联调和回归验证

**优先级:** P2，保证后续每轮优化可重复验证。

**Files:**
- Modify: `scripts/swp-alert-diagnostics-ui.test.mjs`
- Modify: `src/core/swp-event-loader.test.ts`
- Modify: `src/core/swp-event-polling-controller.test.ts`
- Add: `scripts/alert-workflow-regression.test.mjs` when a browser-level check is needed
- Update: `docs/项目详解.md`

**步骤与验收:**

- [ ] 使用真实接口响应脱敏样本覆盖字段映射、状态过滤和分页逻辑。
- [ ] 记录一轮浏览器 Network 验证：呼叫、报警、响应指标三类接口的调用时间和请求参数。
- [ ] 每次任务完成运行 `npm test`、`npm run typecheck`、`npm run build`。
- [ ] 将当月实际完成项追加到 `docs/项目详解.md` 的“月度工作记录”。

## 执行规则

1. 先执行 Task 1，先解决请求频繁问题，再做定位和闭环。
2. 每个 Task 只完成一个可验收目标，不跨任务顺手重构无关模块。
3. 每个行为变更都先写失败测试，确认测试确实失败后再写生产代码。
4. 发现后端协议缺失时，保留明确的本地降级状态，不用模拟成功结果掩盖真实问题。
5. 下一轮开始前先回顾上一轮测试结果和真实页面表现，再决定是否进入后续任务。
