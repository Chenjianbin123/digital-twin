# Shift Nurse Station Scene Left Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift only the nurse-station 3D scene left while preserving its pointer-following motion and overlay positions.

**Architecture:** Add a static CSS custom property for the scene's base horizontal offset and combine it with the existing dynamic pointer offset in the scene transform. Override the base offset at the existing mobile breakpoint.

**Tech Stack:** Vue 3 SFC, SCSS, Node.js built-in test runner, Vite

## Global Constraints

- Desktop base offset is `-32px`.
- Mobile base offset at `max-width: 760px` is `-16px`.
- Do not move nurse-station overlays.
- Add no dependencies.

---

### Task 1: Add Responsive Nurse Station Scene Offset

**Files:**
- Create: `scripts/nurse-station-scene-offset.test.mjs`
- Modify: `src/components/NurseStationVisualScene.vue`

**Interfaces:**
- Consumes: existing `--station-shift-x` pointer-following CSS property
- Produces: `--station-base-x` combined into the scene `translate3d` transform

- [ ] **Step 1: Add a failing source contract test**

Assert that the component defines `--station-base-x: -32px`, combines it with `--station-shift-x`, and overrides it to `-16px` inside the mobile media query.

- [ ] **Step 2: Verify the test fails**

Run `node --test scripts/nurse-station-scene-offset.test.mjs` and expect failure because `--station-base-x` is absent.

- [ ] **Step 3: Implement the responsive base offset**

Define `--station-base-x: -32px` on `.nurse-station-visual`, use `calc(var(--station-base-x) + var(--station-shift-x))` for the X transform, and set `--station-base-x: -16px` on `.nurse-station-visual` inside `@media (max-width: 760px)`.

- [ ] **Step 4: Verify the change**

Run `node --test scripts/nurse-station-scene-offset.test.mjs scripts/nurse-station-room-markers-hidden.test.mjs` and `npm run build`; both must exit successfully.

No commit step is included because the project directory does not contain Git metadata.
