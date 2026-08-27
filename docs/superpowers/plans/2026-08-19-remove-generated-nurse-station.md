# Remove Generated Nurse Station Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the code-generated nurse-station fallback while keeping the high-fidelity GLB and its dynamic display integration.

**Architecture:** `AreaScene` will create an empty nurse-station root and load the GLB directly into it. Generated-scene-only object references and update paths will be removed, while the existing GLB loading, display attachment, camera, controls, and model-state callbacks remain unchanged.

**Tech Stack:** TypeScript, Three.js, Vue, Vite, Node test runner

## Global Constraints

- Keep `high_fidelity_nurse_station.glb` and its Blender source file.
- Keep high-fidelity model fitting and dynamic board-display attachment.
- Do not change corridor or ward-interior behavior.
- A GLB loading error must not reveal the removed generated scene.

---

### Task 1: Remove the generated nurse-station lifecycle

**Files:**
- Modify: `src/core/area-scene.ts`
- Test: `src/core/area-scene-source.test.ts`

**Interfaces:**
- Consumes: `AreaScene.buildNurseStation()`, `AreaScene.loadNurseStationModel(parent)`
- Produces: a nurse-station root that contains only the high-fidelity model and retained hospital environment

- [ ] **Step 1: Write the failing source-contract test**

Add assertions that `area-scene.ts` no longer imports or invokes `buildHospitalNurseStation`, no longer declares `generatedNurseStationGroup`, and still invokes `attachNurseStationBoardDisplays(model)`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test src/core/area-scene-source.test.ts`

Expected: FAIL because the generated fallback still exists.

- [ ] **Step 3: Remove generated-scene creation and object updates**

Change `buildNurseStation()` to create the root group, retain `buildNurseStationHospitalEnvironment(group)`, and start `loadNurseStationModel(group)` without constructing a generated model. Remove generated-scene-only fields, success visibility toggles, schedule-board material replacement, and call-bell material updates.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --experimental-strip-types --test src/core/area-scene-source.test.ts`

Expected: PASS.

### Task 2: Verify project behavior

**Files:**
- Verify: `src/core/area-scene.ts`
- Verify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`

**Interfaces:**
- Consumes: project test and build scripts
- Produces: verified high-fidelity-only nurse-station implementation

- [ ] **Step 1: Run all core tests**

Run: `node --experimental-strip-types --test src/core/*.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: build exits with status 0.

- [ ] **Step 3: Verify references and assets**

Run: `rg -n "buildHospitalNurseStation|generatedNurseStationGroup|generated-nurse-station" src/core/area-scene.ts`

Expected: no matches. Confirm the GLB remains present with `test -f public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`.
