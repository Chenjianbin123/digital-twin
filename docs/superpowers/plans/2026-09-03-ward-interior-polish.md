# Ward Interior Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve ward interior 2.5D/3D presentation for hospital-site large screen use.

**Architecture:** Keep existing data flow and template parsing unchanged. Add presentation-only improvements in Vue shell components and Canvas/Three texture renderers, with small boundary tests for each behavior.

**Tech Stack:** Vue 3, TypeScript, Pinia, Canvas 2D, Three.js, Node test runner.

## Global Constraints

- Do not change bed-head template API parsing flow.
- Keep 2.5D bed click selection behavior.
- Avoid showing duplicate device SN/IP details in overview surfaces.
- Prefer clean large-screen clinical overview over dense debug information.

---

### Task 1: 2.5D Bed Detail Dialog

**Files:**
- Create: `src/components/WardPlanBedDialog.vue`
- Modify: `src/App.vue`
- Test: `scripts/ward-plan-bed-dialog-boundary.test.mjs`

**Steps:**
- [ ] Add failing boundary test requiring `WardPlanBedDialog` to render in 2.5D when `selectedBed` exists.
- [ ] Implement dialog with patient, nursing level, doctor, nurse, warning, and empty-bed states.
- [ ] Verify test and typecheck.

### Task 2: 2.5D Status Emphasis

**Files:**
- Modify: `src/core/bed-status.ts`
- Modify: `src/core/plan-renderer.ts`
- Test: `scripts/ward-status-visual-consistency-boundary.test.mjs`

**Steps:**
- [ ] Add failing boundary test for semantic status palette and abnormal-bed banner.
- [ ] Implement aligned colors and abnormal-bed highlighting.
- [ ] Verify test and typecheck.

### Task 3: 3D Bed Terminal Fallbacks and HUD Simplification

**Files:**
- Modify: `src/core/template/bed-terminal-texture.ts`
- Modify: `src/components/WardScene3D.vue`
- Test: `scripts/ward-3d-terminal-fallback-and-hud-boundary.test.mjs`

**Steps:**
- [ ] Add failing boundary test for fallback copy and simplified HUD.
- [ ] Add explicit loading/no-template/failure fallback text in terminal fallback texture.
- [ ] Remove duplicate SN/detail text from 3D HUD.
- [ ] Verify test and typecheck.

### Task 4: 2.5D Panel Toggle Treatment

**Files:**
- Modify: `src/App.vue`
- Test: `scripts/ward-plan-panel-toggle-compact-boundary.test.mjs`

**Steps:**
- [ ] Add failing boundary test for plan-mode compact panel toggle class.
- [ ] Apply compact class in 2.5D and style as smaller translucent button.
- [ ] Verify test and typecheck.

### Task 5: Final Verification

**Files:**
- All changed files.

**Steps:**
- [ ] Run all new boundary tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run build`.
