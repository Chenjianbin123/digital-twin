# Nurse Station Screen Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the nurse station's existing real area/room data to fill the two rear nurse-station screens with readable “护理交班” and “患者状态” content.

**Architecture:** Keep the existing `Nursing_Board_Title` and `Patient_Status_Bar_02` model bindings and the current `refreshNurseStationBoardDisplays()` refresh path. Add a pure screen-data adapter that derives compact, de-identified rows from `NurseStationLiveData`/`RoomSummary`, then make the two Canvas texture renderers consume that adapter. No new API, mock record, polling loop, or patient name is introduced.

**Tech Stack:** Vue/Three.js scene code, TypeScript, Canvas 2D textures, Node built-in test runner.

## Global Constraints

- Data must come from the current `TwinAreaEntity`, `RoomSummary[]`, and existing live-data builder only.
- Do not add network calls, mock patients, patient names, or new polling intervals.
- Preserve the existing node mapping and texture refresh lifecycle.
- Render Chinese labels, truncate long text within the screen bounds, and keep a usable empty-state when no room data exists.
- Sort attention items by existing room priority: calling, danger, offline, infusing, warning, normal, empty.

---

### Task 1: Define the screen-row adapter with failing tests

**Files:**
- Create: `src/core/nurse-station-screen-data.ts`
- Create: `src/core/nurse-station-screen-data.test.ts`

**Interfaces:**
- Consumes: `RoomSummary[]` and `NurseStationLiveData`.
- Produces: `NurseStationScreenRow`, `buildNurseStationHandoffRows()`, and `buildNurseStationPatientRows()`.

- [x] **Step 1: Write the failing unit tests**

Add tests that require:

```ts
buildNurseStationHandoffRows(summaries, live)
```

to prioritize a calling room, include a Chinese detail containing the call count, and never include a patient name; and require:

```ts
buildNurseStationPatientRows(summaries, live)
```

to include occupied/total beds and a status for the highest-priority room. Add an empty-data case that returns at least one stable “暂无重点事项”/“暂无患者数据” row.

- [x] **Step 2: Run the tests and verify the expected failure**

Run:

```bash
node --test src/core/nurse-station-screen-data.test.ts
```

Expected: FAIL because the adapter module and functions do not exist yet.

- [x] **Step 3: Implement the minimal pure adapter**

Implement the exported row type:

```ts
export interface NurseStationScreenRow {
  roomName: string;
  detail: string;
  status: string;
  state: 'urgent' | 'attention' | 'normal';
  accentColor: string;
}
```

Use the existing summary priority and counts to produce up to three rows per screen, fill unused rows with normal rooms when available, and return one explicit empty row when there is no source data.

- [x] **Step 4: Run the adapter tests**

Run:

```bash
node --test src/core/nurse-station-screen-data.test.ts
```

Expected: PASS.

### Task 2: Render the adapter data on the two existing screens

**Files:**
- Modify: `src/core/area-scene.ts`
- Test: `scripts/nurse-station-screen-data-boundary.test.mjs`

**Interfaces:**
- Consumes: `buildNurseStationHandoffRows()` and `buildNurseStationPatientRows()`.
- Produces: existing `createNurseRearShiftTexture()` and `createNurseRearPriorityTexture()` textures using real room rows while retaining their existing method names and node bindings.

- [x] **Step 1: Write the failing boundary test**

Assert that `area-scene.ts` imports both adapter functions, the shift renderer contains the “护理交班” title and row rendering from the adapter, the patient renderer contains the “患者状态” title and row rendering from the adapter, and the existing mappings for `Nursing_Board_Title` and `Patient_Status_Bar_02` remain present.

- [x] **Step 2: Run the boundary test and verify it fails**

Run:

```bash
node --test scripts/nurse-station-screen-data-boundary.test.mjs
```

Expected: FAIL because the renderers still build rows directly from staff/summary values.

- [x] **Step 3: Integrate the adapter with bounded Canvas rendering**

Import the two adapter functions. Replace the hard-coded three shift rows with adapter rows showing room name, detail, and status; keep nurse/doctor context in the header or a compact footer. Replace the patient-state loop with adapter rows. Keep the existing gradient, border, accent colors, truncation helper, and 900×640 texture size so current model fitting is unchanged.

- [x] **Step 4: Run boundary and focused regression tests**

Run:

```bash
node --test scripts/nurse-station-screen-data-boundary.test.mjs src/core/nurse-station-live-data.test.ts src/core/area-summary.test.ts
```

Expected: PASS.

### Task 3: Typecheck, build, and document the data contract

**Files:**
- Modify: `docs/项目详解.md`

- [x] **Step 1: Run verification**

Run:

```bash
npm run typecheck
npm run build
git diff --check
```

Expected: typecheck/build succeed; any known existing bundle/Sass warnings may remain, but no new error is allowed.

- [x] **Step 2: Document the two-screen mapping**

Document that `Nursing_Board_Title` renders de-identified handoff rows and `Patient_Status_Bar_02` renders room-level occupancy/status rows, both refreshed through the existing nurse-station display refresh and sourced from the current real area payload.

- [x] **Step 3: Run the complete relevant test set**

Run:

```bash
node --test src/core/*.test.ts scripts/*.test.mjs
```

Record only pre-existing unrelated failures separately; do not mask failures introduced by this feature.
