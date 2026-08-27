# Increase Nurse Station Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase only the nurse-station GLB model's vertical scale from `1.10` to `1.16`.

**Architecture:** Keep the existing model fitting pipeline and change its dedicated post-fit Y-axis multiplier. Protect the intended value with a zero-dependency source contract test.

**Tech Stack:** TypeScript, Three.js, Node.js built-in test runner, Vite

## Global Constraints

- Set `NURSE_STATION_MODEL_HEIGHT_SCALE` to `1.16`.
- Do not alter camera, X/Z scale, scene offset, or controls.
- Add no dependencies.

---

### Task 1: Increase Nurse Station Vertical Scale

**Files:**
- Create: `scripts/nurse-station-height-scale.test.mjs`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: existing `fitNurseStationModel` post-fit scaling
- Produces: nurse-station model Y-axis multiplier `1.16`

- [ ] Add a source contract test expecting `NURSE_STATION_MODEL_HEIGHT_SCALE = 1.16` and its use in `model.scale.y`.
- [ ] Run the test and confirm it fails against the current `1.1` value.
- [ ] Change only the height-scale constant to `1.16`.
- [ ] Run the focused test, existing nurse-station tests, and `npm run build`.

No commit step is included because the project directory does not contain Git metadata.
