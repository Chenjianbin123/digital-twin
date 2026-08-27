# Remove Nurse Station Hospital Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the extra Three.js nurse-station wall/sign environment while retaining the high-fidelity GLB and all dynamic display behavior.

**Architecture:** `AreaScene.buildNurseStation()` will keep an empty root whose only visual content is the asynchronously loaded high-fidelity GLB. Corridor sign helpers remain because the ward corridor still uses them; only the nurse-station-specific environment lifecycle is removed.

**Tech Stack:** TypeScript, Three.js, Node.js test runner, Vue 3, Vite

## Global Constraints

- Keep `high_fidelity_nurse_station_v3.glb` and its loading URL unchanged.
- Keep `attachNurseStationBoardDisplays(model)` and live-data refresh behavior.
- Keep the ward corridor safety signs, six-door mapping, door-screen parsing, and ward interior unchanged.
- Do not modify Blender sources or GLB assets.

---

### Task 1: Remove the generated nurse-station environment lifecycle

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: `AreaScene.buildNurseStation()`, `AreaScene.loadNurseStationModel(parent)`
- Produces: a nurse-station root populated only by the high-fidelity GLB

- [ ] **Step 1: Change the source-contract test so the old environment is forbidden**

Replace the positive environment assertions with checks equivalent to:

```js
assert.doesNotMatch(areaScene, /nurseStationHospitalEnvironment/);
assert.doesNotMatch(areaScene, /buildNurseStationHospitalEnvironment/);
assert.doesNotMatch(areaScene, /nurse-station-hospital-environment/);
assert.match(areaScene, /this\.attachNurseStationBoardDisplays\(model\);/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: FAIL because `AreaScene` still declares and builds the generated environment.

- [ ] **Step 3: Remove only the nurse-station environment code**

In `src/core/area-scene.ts`, remove:

```ts
private nurseStationHospitalEnvironment: THREE.Group | null = null;
```

Remove the `this.buildNurseStationHospitalEnvironment(group)` call, the complete `buildNurseStationHospitalEnvironment` method, its stale commented integration call, and its explicit disposal branch. Do not remove `createSignTexture`, `addWallMountedSign`, or `buildCorridorSafetySigns` because the ward corridor uses them.

- [ ] **Step 4: Run focused nurse-station contracts**

Run: `node scripts/nurse-station-scene-boundary.test.mjs && node scripts/nurse-station-complete-optimization.test.mjs`

Expected: both scripts print their success messages and exit 0.

### Task 2: Verify behavior and presentation

**Files:**
- Verify: `src/core/area-scene.ts`
- Verify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station_v3.glb`

**Interfaces:**
- Consumes: the nurse-station scene lifecycle from Task 1
- Produces: a tested build and visual proof that the obsolete environment is gone

- [ ] **Step 1: Run the project test suite**

Run the existing TypeScript and boundary tests discovered under `src/**/*.test.ts` and `scripts/*.test.mjs`.

Expected: all tests exit 0; any old positive assertion for the removed environment must be updated rather than skipped.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript checking and Vite build exit 0.

- [ ] **Step 3: Inspect the running app**

Open the active Vite URL, log in with the configured local account if necessary, and switch to the nurse-station phase.

Expected: the high-fidelity nurse station and live display surfaces render; the generated top wall, light panels, and “护士站 / 请保持安静” signs from the screenshot are absent.

- [ ] **Step 4: Confirm untouched corridor behavior**

Switch to the six-door ward corridor and inspect one room entry.

Expected: the corridor model, door click targets, dynamic door screens, zoom/rotation controls, and ward interior transition continue to work.
