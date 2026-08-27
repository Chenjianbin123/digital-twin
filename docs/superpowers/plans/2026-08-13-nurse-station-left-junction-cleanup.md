# Nurse Station Left Junction Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the left nurse-station junction so the counter, corridor rails, doorway, wall base and wayfinding sign read as one deliberate architectural composition.

**Architecture:** Keep the existing Blender-to-GLB pipeline and change only its generated detail geometry and corridor clearances. Update the station camera constants independently in `area-scene.ts`, then force a new GLB URL version and verify the final exported GLB from the same close view shown by the user.

**Tech Stack:** Blender Python, glTF/GLB, Three.js, Vue 3, Node boundary tests.

## Global Constraints

- Preserve JSON-driven screen template parsing.
- Preserve room patient-count bed generation.
- Do not reintroduce plants.
- Do not apply non-uniform nurse-station model scaling.
- Do not move the corridor doors or nurse counter in this cleanup.

---

### Task 1: Lock the cleanup contract

**Files:**
- Modify: `scripts/nurse-station-model-detail-boundary.test.mjs`
- Modify: `scripts/nurse-station-corridor-width-boundary.test.mjs`
- Modify: `scripts/nurse-station-height-scale.test.mjs`
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `scripts/nurse-station-complete-optimization.test.mjs`

**Interfaces:**
- Consumes: Current Blender export script and camera constants.
- Produces: Failing checks for no lateral counter lights, 0.18 m rail clearance, refined camera framing and the v10 asset URL.

- [ ] Add assertions for the intended geometry and camera values.
- [ ] Run the focused tests and confirm they fail against v9.

### Task 2: Repair Blender geometry and export v10

**Files:**
- Modify: `scripts/export_high_fidelity_nurse_station_glb.py`
- Modify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Modify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`

**Interfaces:**
- Consumes: Existing idempotent enhancement and rail segmentation functions.
- Produces: A source `.blend` and runtime `.glb` without side light bars, with 0.18 m door clearance and aligned rail endings.

- [ ] Remove the generated left/right side light bars while retaining the front light strip.
- [ ] Increase the rail-to-door opening margin to 0.18 m.
- [ ] Re-export the Blender source and GLB.
- [ ] Render the final GLB from the reported close angle and inspect it.

### Task 3: Refine framing and complete verification

**Files:**
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: The v10 GLB asset.
- Produces: A slightly wider and higher station framing that keeps the wayfinding sign visible.

- [ ] Raise the camera target from 1.30 m to 1.38 m and increase initial distance from 5.08 m to 5.35 m.
- [ ] Update the GLB query version to `20260813-junction-cleanup-v10`.
- [ ] Run Blender source and GLB contracts, all station boundary tests, typecheck and production build.
- [ ] Verify the local application starts and serves the new asset URL.
