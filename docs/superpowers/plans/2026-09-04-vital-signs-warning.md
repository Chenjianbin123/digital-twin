# Vital Signs Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将真实 SWP 体征报警事件接入数字孪生平台，形成从接口接收、病区/床位定位、护士处理查看到后端状态恢复自动消失的完整闭环。

**Architecture:** 复用现有 `swp/swpCallInfo/querySwpCallInfo` 活动事件轮询和可选实时通道，不新增高频轮询。通过 `callModeCode=8` 或后端返回的“体征报警”名称识别生命体征事件，保留事件中的真实指标、数值、单位和阈值描述；事件进入现有 Pinia 告警队列，护士站、病区走廊、病房详情和 3D 床位高亮共用同一条状态链路，事件从后端活动列表消失后自动清理。

**Tech Stack:** Vue 3、Pinia、TypeScript、Three.js、Node test runner、现有 SWP HTTP/WebSocket 数据链路。

## Global Constraints

- 真实预警来源必须来自 SWP 活动事件或已配置的真实实时通道，不在前端凭空生成医疗报警。
- 不新增独立高频请求；生命体征报警复用已有 SWP 事件轮询，默认 15 秒刷新。
- 不在前端硬编码医疗阈值判定；仅展示后端已经判定并上报的报警指标和值。
- 事件必须按真实病区、病房和床位标识定位；缺少定位字段时显示“暂无法定位”，不得猜测床位。
- 活动事件只能由后端状态恢复自动结束，前端不能手动隐藏或伪造完成。
- 保留当前工作区已有用户改动，不扫描或修改 `node_modules`、`dist`、`.git`、缓存、`.env` 和无关文件。
- 患者姓名继续使用当前脱敏策略，页面不展示设备编码等技术字段。

---

### Task 1: 建立体征报警数据契约和识别规则

**Files:**

- Modify: `src/types/swp-events.ts`
- Modify: `src/core/swp-event-normalizer.ts`
- Create: `src/core/vital-signs-warning.test.ts`
- Test: `src/core/swp-event-normalizer.test.ts`（如不存在则创建）

**Interfaces:**

- Consumes: `SwpCallRecord` 的 `callModeCode`、`callModeName`、`callMessage`、`remark` 及可能存在的扩展字段。
- Produces: `NormalizedSwpEvent.taskType === 'vital'`，以及 `vitalMetric`、`vitalValue`、`vitalUnit`、`vitalThreshold` 可选字段。

- [ ] **Step 1: Write the failing tests**

```ts
test('recognizes callModeCode 8 as a vital warning', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 1,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 8,
      callModeName: '体征报警',
      callStartTime: '2026-09-04 10:24:00',
      callFrom: 'B-01',
      callMessage: '血氧 88%',
    }],
    alarms: [],
  });
  assert.equal(event?.taskType, 'vital');
  assert.match(event?.description ?? '', /血氧 88%/);
});

test('recognizes the backend vital-warning label when code is absent', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 2,
      areaId: 18,
      eventStatus: '0',
      callModeName: '生命体征预警',
      callStartTime: '2026-09-04 10:25:00',
      callFrom: 'B-01',
    }],
    alarms: [],
  });
  assert.equal(event?.taskType, 'vital');
});

test('does not classify ordinary calls as vital warnings', () => {
  const [event] = normalizeSwpEvents({
    areaId: 18,
    area: areaWithBed,
    calls: [{
      id: 3,
      areaId: 18,
      eventStatus: '0',
      callModeCode: 0,
      callModeName: '正常呼叫',
      callStartTime: '2026-09-04 10:26:00',
      callFrom: 'B-01',
    }],
    alarms: [],
  });
  assert.equal(event?.taskType, 'call');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/core/vital-signs-warning.test.ts`

Expected: FAIL because `taskType` has no `vital` variant and the normalizer treats every call as `call`.

- [ ] **Step 3: Implement the minimal normalizer contract**

```ts
export type NormalizedVitalMetric =
  | 'temperature'
  | 'heartRate'
  | 'respiratoryRate'
  | 'bloodPressure'
  | 'bloodOxygen'
  | 'bloodSugar'
  | 'mews'
  | 'unknown';

export interface NormalizedSwpEvent {
  // existing fields
  taskType: 'call' | 'infusion' | 'vital';
  vitalMetric?: NormalizedVitalMetric;
  vitalValue?: string;
  vitalUnit?: string;
  vitalThreshold?: string;
}
```

Add a pure `isVitalSignsCall(record)` helper that accepts numeric/string code `8` or a `callModeName` containing `体征`/`生命体征`/`MEWS`/`Mews`, then build a human-readable description from backend `callMessage`/`remark` and known extension keys without inventing a value. Keep the original event ID and occurrence timestamp logic.

- [ ] **Step 4: Run the focused tests**

Run: `node --experimental-strip-types --test src/core/vital-signs-warning.test.ts`

Expected: PASS.

### Task 2: Put vital events into the source-managed alert workflow

**Files:**

- Modify: `src/core/alert-workflow.ts`
- Modify: `src/stores/twin-store.ts`
- Modify: `src/types/twin.ts`
- Create: `scripts/vital-signs-warning-workflow-boundary.test.mjs`

**Interfaces:**

- Consumes: `NormalizedSwpEvent` from Task 1 and `TwinAreaEntity`.
- Produces: `AlertTask.type === 'vital'`, source-managed lifecycle, stable deduplication, and category `vital`.

- [ ] **Step 1: Write the failing workflow tests**

```js
assert.match(alertWorkflow, /AlertTaskType = 'call' \| 'env' \| 'offline' \| 'infusion' \| 'inspection' \| 'vital'/);
assert.match(alertWorkflow, /event\.taskType === 'vital'/);
assert.match(alertWorkflow, /vitalMetric/);
assert.match(twinTypes, /HistoryCategory = 'infusion' \| 'env' \| 'call' \| 'device' \| 'vital'/);
```

Also exercise `collectSwpAlertTasks` with one vital event and assert it is pending, source-managed, locatable only when the event has a matched bed, and remains present after an attempted frontend resolve.

- [ ] **Step 2: Run the boundary test to verify it fails**

Run: `node --test scripts/vital-signs-warning-workflow-boundary.test.mjs`

Expected: FAIL because the alert workflow only knows call/infusion/inspection types.

- [ ] **Step 3: Implement the minimal workflow changes**

Extend the alert type/category unions, copy vital fields from the normalized event to the task, use critical severity for a backend vital warning unless the normalized event already carries a more specific supported severity, and add labels:

```ts
if (type === 'vital')
  return '生命体征';

function isSourceManagedTask(task: AlertTask) {
  return task.source === 'swp-call'
    && (task.type === 'call' || task.type === 'vital')
    || task.source === 'swp-inspection';
}
```

Do not add a frontend resolve path for vital tasks. Keep `eventStartedAt` in acknowledgement state only for compatibility; active vital events are always governed by the current backend snapshot.

- [ ] **Step 4: Verify workflow tests**

Run: `node --test scripts/vital-signs-warning-workflow-boundary.test.mjs`

Expected: PASS.

### Task 3: Accept real-time vital push messages without another poller

**Files:**

- Modify: `src/services/realtime-channel.ts`
- Modify: `src/stores/twin-store.ts`
- Create: `src/core/realtime-vital-warning.test.ts`

**Interfaces:**

- Consumes: configured `VITE_REALTIME_URL` messages in the existing WebSocket/SSE channel, including Android-compatible `sendMewsAlarm` envelopes when present.
- Produces: a normalized source-managed vital event merged into the same `swpEvents` state; polling remains the source of truth for automatic recovery.

- [ ] **Step 1: Write the failing test**

```ts
test('normalizes sendMewsAlarm payload into a vital event', () => {
  const event = normalizeRealtimeVitalMessage({
    Cmd: 'sendMewsAlarm',
    Message: {
      bedId: 1,
      bedName: '3床',
      sickroomId: 'R-01',
      pushTime: '2026-09-04 10:30:00',
      mewsAlarmLevel: '高',
      mewsScore: '7',
      tw: '38.8℃',
      ecg: '125次/分',
      hx: '28次/分',
      ssy: '185mmHg',
    },
  });
  assert.equal(event?.taskType, 'vital');
  assert.match(event?.description ?? '', /MEWS|体征/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/core/realtime-vital-warning.test.ts`

Expected: FAIL because the realtime channel currently ignores `sendMewsAlarm`.

- [ ] **Step 3: Implement a guarded realtime adapter**

Add a pure adapter that only accepts `Cmd === 'sendMewsAlarm'`, copies actual message values, scopes the event to the active area, and calls a store method such as `applyRealtimeVitalWarning(expectedAreaId, payload)`. Do not expose or persist a fake event when the message has no bed/room identity. Do not add a timer or retry loop beyond the existing channel reconnect.

- [ ] **Step 4: Run the realtime test**

Run: `node --experimental-strip-types --test src/core/realtime-vital-warning.test.ts`

Expected: PASS.

### Task 4: Render the warning in all nurse-facing surfaces

**Files:**

- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/components/AreaInfoPanel.vue`
- Modify: `src/components/WardInfoPanel.vue`
- Modify: `src/App.vue`
- Create: `scripts/vital-signs-warning-ui-boundary.test.mjs`

**Interfaces:**

- Consumes: `AlertTask.type === 'vital'`, `vitalMetric`, `vitalValue`, `vitalUnit`, `vitalThreshold`, and existing `latestVitals`.
- Produces: concise nurse-readable warning cards with no API field names or device codes.

- [ ] **Step 1: Write the failing UI-boundary test**

```js
assert.match(alertPanel, /生命体征/);
assert.match(alertPanel, /vital/);
assert.match(nursePanel, /生命体征预警/);
assert.match(areaPanel, /生命体征预警/);
assert.match(wardPanel, /latestVitals/);
assert.match(app, /activeAlertTask\.type === 'vital'/);
```

- [ ] **Step 2: Run the boundary test**

Run: `node --test scripts/vital-signs-warning-ui-boundary.test.mjs`

Expected: FAIL because current labels only cover call, infusion, environment, device, and inspection.

- [ ] **Step 3: Implement the nurse-facing presentation**

Use the existing dark glass/blue scan-line visual language. Add a red/amber vital variant with a restrained pulse indicator and `prefers-reduced-motion` fallback. Display only:

```text
紧急 · 3床 张* · 血氧 88% · 10:24 · 生命体征预警
```

The nurse station should show a vital warning count/KPI and include it in response pressure. The corridor room card should show `生命体征预警 N 床` and use the warning accent. The ward detail should show the active warning summary above the normal latest-vitals card, preserving the record time and actual values. Locate actions should use the existing scene navigation and never claim that the browser can answer a call.

- [ ] **Step 4: Verify UI boundaries**

Run: `node --test scripts/vital-signs-warning-ui-boundary.test.mjs`

Expected: PASS.

### Task 5: Highlight the affected bed in the 3D scene

**Files:**

- Modify: `src/components/WardScene3D.vue`
- Modify: `src/core/ward-scene.ts`
- Modify: `src/App.vue`
- Test: `src/core/ward-scene-controls.test.ts` or `scripts/vital-signs-warning-ui-boundary.test.mjs`

**Interfaces:**

- Consumes: current source-managed vital task target and selected bed.
- Produces: red/amber bed warning glow, low-frequency pulse, and the existing eight-second focus behavior.

- [ ] **Step 1: Write the failing scene-boundary assertion**

```js
assert.match(wardScene3d, /vital-warning/);
assert.match(wardScene, /setVitalWarningBedCodes/);
assert.match(app, /vitalWarningBedCodes/);
```

- [ ] **Step 2: Run the assertion**

Run: `node --test scripts/vital-signs-warning-ui-boundary.test.mjs`

Expected: FAIL because `WardScene` only receives selected bed state and environment level.

- [ ] **Step 3: Implement the visual state**

Pass the current ward’s active vital bed codes from `App.vue` to `WardScene3D`. In `WardScene`, maintain a set of warning bed codes, apply a dedicated emissive edge/halo to matching bed groups, clear it when the task disappears, and keep selection/focus behavior unchanged. Keep the animation disabled under `prefers-reduced-motion` in the component overlay styles.

- [ ] **Step 4: Verify scene behavior**

Run: `node --experimental-strip-types --test src/core/ward-scene-controls.test.ts`

Expected: PASS.

### Task 6: Verify event lifecycle and real-data behavior

**Files:**

- Modify: `src/core/swp-event-loader.ts` only if source preservation needs adjustment
- Modify: `src/core/swp-event-polling-controller.ts` only if stale-response tests expose a gap
- Test: `src/core/swp-event-loader.test.ts`
- Test: `src/core/swp-event-polling-controller.test.ts`
- Test: `scripts/vital-signs-warning-workflow-boundary.test.mjs`

- [ ] **Step 1: Add lifecycle tests**

Cover:

```ts
// same id + same start time => one task
// same id + new start time => new task
// event removed from the refreshed swp-call source => task disappears
// area switch / late response => old warning never appears in the new area
// no bed identity => canLocate === false and no guessed target
```

- [ ] **Step 2: Run focused lifecycle tests**

Run: `node --experimental-strip-types --test src/core/swp-event-loader.test.ts src/core/swp-event-polling-controller.test.ts`

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

Expected: all commands exit with code `0`; report any pre-existing unrelated failures separately.

