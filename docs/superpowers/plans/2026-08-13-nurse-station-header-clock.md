# Nurse Station Header And Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve header readability, integrate the live clock, and lower the default camera framing.

**Architecture:** Change the exported Blender model only for physical header and clock geometry. Keep time rendering and business screen data in `AreaScene`, and change only its default camera target and clock typography.

**Tech Stack:** Blender Python, Three.js, TypeScript, Vue, Node boundary tests, Vite.

## Global Constraints

- Preserve live clock and JSON-driven screen mappings.
- Do not bake representative data into the model.
- Do not non-uniformly scale the model or text.
- Keep both ward direction signs visible.

---

### Task 1: Lock The Presentation Contract

**Files:**
- Modify: `scripts/nurse-station-page-presentation-boundary.test.mjs`

- [ ] Assert camera target `new THREE.Vector3(0, 1.32, -0.05)`.
- [ ] Assert the enlarged Blender header/subtitle values and `Clock_Display` dimensions.
- [ ] Assert `Clock_Display` remains mapped to `clock`.
- [ ] Run the test and confirm it fails against the old values.

### Task 2: Update Model And Page Rendering

**Files:**
- Modify: `scripts/export_high_fidelity_nurse_station_glb.py`
- Modify: `src/core/area-scene.ts`

- [ ] Enlarge the header typography without changing its proportions.
- [ ] Enlarge and align `Clock_Display` with the header baseline.
- [ ] Increase live clock canvas typography while keeping system time rendering.
- [ ] Lower the camera target to `Y=1.32`.
- [ ] Run the focused boundary test and confirm it passes.

### Task 3: Export And Verify

**Files:**
- Modify generated source: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Modify generated asset: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`

- [ ] Run the approved Blender background exporter.
- [ ] Run Blender source and GLB validators.
- [ ] Run all nurse-station boundary tests.
- [ ] Run `npm run build`.
- [ ] Confirm the local preview server responds.

