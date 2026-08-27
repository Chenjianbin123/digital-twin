# Nurse Station Content Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition information surfaces so titles and primary data are fully visible in the approved PC camera view.

**Architecture:** Add one idempotent Blender export-stage layout function that moves named object groups from their source positions. Keep canvas rendering and API mappings unchanged, then export and validate both source and runtime GLB.

**Tech Stack:** Blender Python, Three.js, Node boundary tests, Vite.

## Global Constraints

- Keep camera target `new THREE.Vector3(0, 1.32, -0.05)`.
- Preserve live clock and JSON-driven work-screen mappings.
- Do not change corridor doors, ward models, or bed-template parsing.

---

### Task 1: Add A Failing Visibility Contract

**Files:**
- Create: `scripts/nurse-station-content-visibility-boundary.test.mjs`

- [ ] Assert an idempotent `optimize_information_visibility()` export step.
- [ ] Assert rear-board offsets `z=-0.22`, side-board offsets `x=0.18`, symmetric small-sign offset `z=-0.18`, and the dedicated clock mount.
- [ ] Assert the existing `Screen_Main`, work-screen, and `Clock_Display` mappings remain present.
- [ ] Run the test and confirm it fails before implementation.

### Task 2: Implement Group Repositioning

**Files:**
- Modify: `scripts/export_high_fidelity_nurse_station_glb.py`
- Modify: `src/core/area-scene.ts`

- [ ] Add source-position-based named groups for the three rear boards.
- [ ] Move every child object in each group with its frame and face.
- [ ] Move both small wayfinding sign groups down equally.
- [ ] Keep the enlarged clock at `X=4.85, Z=3.10` and free its lower-right space by moving the small sign down.
- [ ] Change the GLB cache version and run the focused boundary test to green.

### Task 3: Export And Verify

**Files:**
- Modify: `scripts/validate_high_fidelity_nurse_station.py`
- Modify: `scripts/validate_high_fidelity_nurse_station_glb.py`
- Regenerate: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Regenerate: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`

- [ ] Verify final source positions and group alignment.
- [ ] Export the Blender source and GLB.
- [ ] Run source and GLB contracts, all nurse-station tests, and `npm run build`.
- [ ] Refresh the running local preview and visually inspect the authenticated page when available.
