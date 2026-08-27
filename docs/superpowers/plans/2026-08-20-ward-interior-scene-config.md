# Ward Interior Scene Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize the ward-interior model, room, camera presets, responsive framing, controls, appearance, and GLB-bed layout values in one typed config file.

**Architecture:** `src/config/ward-interior-scene.ts` owns editable numeric and asset values. Model validation, fitting, camera calculations, controls, and scene rendering remain in focused core modules and consume the config without moving patient, bed-status, terminal-screen, or alert logic.

**Tech Stack:** TypeScript, Three.js, Node.js test runner, Vue 3, Vite

## Global Constraints

- Keep the current required GLB node contract and dynamic screen behavior.
- Keep camera preset IDs `free`, `door`, `nurse`, and `top` unchanged.
- Keep current visual defaults behaviorally unchanged.
- Do not move patient data, bed status, template rendering, selection, or alert logic into config.
- The workspace is not a Git repository; skip commit steps.

---

### Task 1: Add the ward-interior configuration contract

**Files:**
- Create: `src/config/ward-interior-scene.ts`
- Create: `scripts/ward-interior-scene-config-boundary.test.mjs`

**Interfaces:**
- Produces: `wardInteriorSceneConfig` with `model`, `room`, `camera`, `controls`, `appearance`, and `modelBedLayout` sections.

- [ ] **Step 1: Write a failing source-contract test**

Assert that the config contains the current GLB URL/base size, room height, initial camera, four preset values, viewport scale thresholds, control values, appearance values, and model-bed layout values. Assert consumer imports in `ward-interior-model.ts`, `ward-scene-controls.ts`, `camera-presets.ts`, and `ward-scene.ts`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node scripts/ward-interior-scene-config-boundary.test.mjs`

Expected: FAIL because the config does not exist.

- [ ] **Step 3: Create the typed config**

Define the existing defaults in this shape:

```ts
export const wardInteriorSceneConfig = {
  model: {
    url: '/models/smart-ward-interior/smart_ward_interior.glb?v=20260812-terminal-layout-v4',
    baseSize: { width: 12, height: 3.92, depth: 9 },
    canvasTextureFlipY: false,
  },
  room: { height: 4.2 },
  camera: { /* FOV, clipping, initial view, presets, transitions and viewport scale */ },
  controls: { /* damping, speed, open limits and maximum-distance formula */ },
  appearance: { background: 0xe8eeea, exposure: 1.05, baseFogDensity: 0.012, fogSpanFactor: 0.00015 },
  modelBedLayout: { baseWidth: 3.92, backOffset: 2.71, horizontalMargin: 1, minScale: 0.7, maxScale: 1, maxBeds: 6 },
} as const;
```

- [ ] **Step 4: Run the focused test far enough to reach consumer assertions**

Expected: FAIL because existing modules still own the literals.

### Task 2: Connect ward-interior modules to the config

**Files:**
- Modify: `src/core/ward-interior-model.ts`
- Modify: `src/core/ward-scene-controls.ts`
- Modify: `src/core/camera-presets.ts`
- Modify: `src/core/ward-scene.ts`
- Modify: `src/core/camera-presets.test.ts`
- Modify: `src/core/ward-interior-model.test.ts`
- Modify: `src/core/ward-scene-controls.test.ts`
- Modify: `scripts/ward-interior-model-integration-boundary.test.mjs`
- Modify: `scripts/ward-scene-view-boundary.test.mjs`

**Interfaces:**
- Consumes: `wardInteriorSceneConfig`
- Preserves: `WARD_INTERIOR_MODEL_URL`, `WARD_INTERIOR_BASE_SIZE`, `CAMERA_PRESETS`, `getCameraPreset()`, `resolveWardCameraViewportScale()`, and `resolveWardSceneControlLimits()`.

- [ ] **Step 1: Replace model and bed-layout literals**

Keep public exports stable, assigning the model URL/base size from config. Use configured texture orientation and model-bed layout values in the existing algorithms. Do not configure or weaken required-node validation.

- [ ] **Step 2: Replace camera preset and responsive literals**

Build `CAMERA_PRESETS` from configured presets and use configured viewport reference aspect/minimum/maximum scales.

- [ ] **Step 3: Replace controls and WardScene literals**

Read room height, FOV, clipping planes, initial position/target, damping, speeds, background, exposure, fog coefficients, preset transition duration, and focus transition duration from config. Keep existing formulas and event behavior.

- [ ] **Step 4: Run focused ward-interior tests**

Run:

```bash
node scripts/ward-interior-scene-config-boundary.test.mjs
node --experimental-strip-types --test src/core/ward-interior-model.test.ts src/core/ward-scene-controls.test.ts
node --test scripts/ward-scene-view-boundary.test.mjs scripts/ward-interior-model-integration-boundary.test.mjs
```

Expected: all pass.

### Task 3: Document ward-interior model and scene configuration

**Files:**
- Create: `docs/model-guides/ward-interior-model-configuration.md`
- Modify: `docs/model-guides/README.md`

**Interfaces:**
- Consumes: exact field names from `wardInteriorSceneConfig`.

- [ ] **Step 1: Write the guide**

Document GLB placement/versioning, required group and screen nodes, base-size fitting, room height, initial camera, preset editing, responsive scale, open controls, appearance, model-bed layout invariants, test commands, and visual acceptance steps.

- [ ] **Step 2: Add the guide to the model documentation index**

Add a Markdown link from `docs/model-guides/README.md`.

- [ ] **Step 3: Run full verification**

Run:

```bash
node --experimental-strip-types --test src/core/*.test.ts
node --test scripts/*.test.mjs
npm run build
```

Expected: all tests and the production build pass.
