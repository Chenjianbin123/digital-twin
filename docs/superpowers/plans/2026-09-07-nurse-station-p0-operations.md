# Nurse Station P0 Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the nurse-station experience with a practical alert work queue, explicit data freshness feedback, and a dedicated full-screen wallboard mode without changing the real-interface safety boundary.

**Architecture:** Keep SWP calls display-only and continue deriving the queue from the existing `AlertTask[]` data. Add filtering and status summaries in the alert panel, expose per-source freshness through the existing data-health model, and let the nurse-station shell switch between workstation and wallboard presentation using a local UI preference. Do not add new polling loops or invent backend records.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Pinia, scoped SCSS, Node built-in test runner, existing Three.js nurse-station scene.

## Global Constraints

- Real SWP calls remain read-only in the browser; only source recovery may end an SWP task.
- Remote mode must not silently fall back to mock data.
- Existing area switching, scene positioning, template rendering, and 60-second event polling must remain unchanged.
- Patient-facing text stays Chinese and must remain readable in the existing technology-styled UI.
- New UI state must be local and reversible; no backend schema changes are required for this phase.
- Respect `prefers-reduced-motion` for any new animation.

---

### Task 1: Add alert work-queue filters and summary

**Files:**
- Modify: `src/components/AlertTaskPanel.vue`
- Modify: `src/components/NurseStationPanel.vue`
- Test: `scripts/nurse-station-alert-work-queue.test.mjs`

**Interfaces:**
- Consumes: existing `AlertTask[]`, `AlertAckRecordMap`, and task source/status fields.
- Produces: `filter` prop (`'active' | 'handling' | 'all'`), a visible queue summary, and stable filtering that does not mutate source tasks.

- [ ] **Step 1: Write the failing boundary test**

Add assertions that `AlertTaskPanel.vue` exposes the three filter labels, keeps SWP calls display-only, and that `NurseStationPanel.vue` passes the filter state into the panel.

- [ ] **Step 2: Run the boundary test and verify it fails**

Run:

```bash
node --test scripts/nurse-station-alert-work-queue.test.mjs
```

Expected: FAIL because the filter controls and `filter` prop do not exist yet.

- [ ] **Step 3: Implement the smallest queue filter**

Add a `filter` prop with default `'active'`, a local computed `filteredTasks`, and three buttons labelled `未处理`, `处理中`, and `全部`. Keep source-managed SWP calls in the active view regardless of local acknowledgement records, and continue emitting only the existing locate/handling/resolve/restore events.

In `NurseStationPanel.vue`, add a local `alertFilter` ref and pass it to `AlertTaskPanel`; do not add a second task-fetching path.

- [ ] **Step 4: Run the boundary test and the existing alert tests**

Run:

```bash
node --test scripts/nurse-station-alert-work-queue.test.mjs src/core/alert-workflow.test.ts
```

Expected: PASS with no change to SWP display-only assertions.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/AlertTaskPanel.vue src/components/NurseStationPanel.vue scripts/nurse-station-alert-work-queue.test.mjs
git commit -m "feat: add nurse station alert work queue filters"
```

### Task 2: Make data freshness actionable

**Files:**
- Modify: `src/core/data-status.ts`
- Modify: `src/components/NurseStationPanel.vue`
- Test: `src/core/data-status.test.ts`
- Test: `scripts/nurse-station-data-freshness-boundary.test.mjs`

**Interfaces:**
- Consumes: existing `DataStatus`, `SwpEventSyncState`, `SwpResponseSync`, `InspectionSyncState`, and `wardDataStatus`.
- Produces: source-specific freshness labels and a single “last successful sync” summary without changing API calls.

- [ ] **Step 1: Write the failing unit and boundary tests**

Add a unit case for a stale event source that expects a `stale`/attention result rather than a normal state. Add boundary assertions that the nurse station renders event, response, inspection, and ward freshness labels plus the latest timestamp.

- [ ] **Step 2: Run tests and verify the new expectations fail**

Run:

```bash
node --test src/core/data-status.test.ts scripts/nurse-station-data-freshness-boundary.test.mjs
```

Expected: FAIL because the current panel only exposes a combined data-health list.

- [ ] **Step 3: Implement source-level freshness display**

Extend the existing data-health view with four compact source rows:

```ts
[
  { key: 'ward', label: '病区数据', status: wardDataStatus, syncedAt: ... },
  { key: 'events', label: '呼叫报警', status: swpEventSync, syncedAt: ... },
  { key: 'response', label: '响应指标', status: swpResponseSync, syncedAt: ... },
  { key: 'inspection', label: '巡视记录', status: inspectionSync, syncedAt: ... },
]
```

Use `--` when a source has never synced, show `同步中/正常/部分同步/已延迟/中断`, and preserve the existing warning that prevents declaring the ward normal when data is incomplete.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
node --test src/core/data-status.test.ts scripts/nurse-station-data-freshness-boundary.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/core/data-status.ts src/core/data-status.test.ts src/components/NurseStationPanel.vue scripts/nurse-station-data-freshness-boundary.test.mjs
git commit -m "feat: expose nurse station data freshness"
```

### Task 3: Add nurse-station wallboard mode

**Files:**
- Modify: `src/components/NurseStationPanel.vue`
- Modify: `src/App.vue`
- Modify: `src/styles/dashboard.scss`
- Test: `scripts/nurse-station-wallboard-mode.test.mjs`

**Interfaces:**
- Consumes: existing scene type, current area name, alert count, and the current nurse-station panel.
- Produces: a reversible `wallboard` UI mode stored under `ward-digital-twin:nurse-station-wallboard`.

- [ ] **Step 1: Write the failing boundary test**

Assert that the app has a nurse-station-only wallboard toggle, uses a root class or attribute for wallboard mode, and renders a visible exit control. Assert that corridor and ward-interior scenes do not receive the wallboard class.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test scripts/nurse-station-wallboard-mode.test.mjs
```

Expected: FAIL because there is no wallboard preference or mode class.

- [ ] **Step 3: Implement wallboard mode**

Add a small local state in `App.vue`:

```ts
const NURSE_STATION_WALLBOARD_KEY = 'ward-digital-twin:nurse-station-wallboard';
const nurseStationWallboard = ref(readBooleanPreference(NURSE_STATION_WALLBOARD_KEY));
```

Only apply `nurse-station--wallboard` when `sceneType === 'nurse-station'`. Add a compact toggle near the nurse-station panel header and an always-visible `退出大屏` control in wallboard mode. Use CSS to enlarge the priority queue, KPI values, and current area name while hiding secondary details; keep the 3D model full-screen and preserve the normal workstation layout when disabled.

- [ ] **Step 4: Run tests, typecheck, and build**

Run:

```bash
node --test scripts/nurse-station-wallboard-mode.test.mjs
npm run typecheck
npm run build
```

Expected: PASS; build may continue to report the existing chunk-size and Sass deprecation warnings.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/NurseStationPanel.vue src/App.vue src/styles/dashboard.scss scripts/nurse-station-wallboard-mode.test.mjs
git commit -m "feat: add nurse station wallboard mode"
```

### Task 4: Full regression verification and documentation

**Files:**
- Modify: `docs/项目详解.md`

- [ ] **Step 1: Run the complete verification set**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Record unrelated pre-existing boundary-test failures separately instead of masking them.

- [ ] **Step 2: Document the new operator workflow**

Update the nurse-station section with the filter meanings, source freshness semantics, wallboard toggle location, and the fact that SWP calls remain display-only.

- [ ] **Step 3: Commit documentation**

```bash
git add docs/项目详解.md
git commit -m "docs: describe nurse station operator workflow"
```
