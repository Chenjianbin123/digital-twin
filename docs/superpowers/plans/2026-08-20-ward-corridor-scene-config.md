# Ward Corridor Scene Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize the six-door ward corridor model, camera, controls, appearance, and fallback geometry values in one typed config file.

**Architecture:** `src/config/ward-corridor-scene.ts` becomes the only literal-value source for corridor presentation and the physical GLB contract. Existing core modules keep their algorithms and public exports, consuming config values without moving door-screen parsing or room binding logic.

**Tech Stack:** TypeScript, Three.js, Node.js test runner, Vue 3, Vite

## Global Constraints

- Keep the current six-door room binding order and dynamic door-screen rendering behavior.
- Keep the current GLB URL and all default visual values behaviorally unchanged.
- Do not move authorization, room data, template parsing, or click navigation into config.
- The workspace is not a Git repository; skip commit steps.

---

### Task 1: Add the corridor configuration contract

**Files:**
- Create: `src/config/ward-corridor-scene.ts`
- Create: `scripts/ward-corridor-scene-config-boundary.test.mjs`

**Interfaces:**
- Produces: `wardCorridorSceneConfig` with `model`, `camera`, `controls`, `appearance`, and `fallbackGeometry` sections.

- [ ] **Step 1: Write a failing source-contract test**

Assert that the config file exists and contains the existing model URL, six door node names, `slotCount: 6`, camera coefficients, open control limits, `background: 0x0a1218`, and fallback geometry values. Assert that `ward-corridor-model.ts`, `ward-corridor-camera.ts`, `area-corridor-controls.ts`, and `area-scene.ts` import or consume `wardCorridorSceneConfig`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node scripts/ward-corridor-scene-config-boundary.test.mjs`

Expected: FAIL because the new config does not exist.

- [ ] **Step 3: Create the typed config**

Define the existing defaults in this shape:

```ts
export const wardCorridorSceneConfig = {
  model: {
    url: '/models/hospital-corridor/hospital-in.glb?v=20260818-hospital-corridor-v1',
    rotationX: -Math.PI / 2,
    slotCount: 6,
    doorNodeNames: ['门1', '门2', '门2.001', '门3', '门4', '门5'],
    canvasTextureFlipY: false,
  },
  camera: { /* existing GLB bounds coefficients and FOV thresholds */ },
  controls: { /* current open polar/azimuth/distance limits and speeds */ },
  appearance: { background: 0x0a1218 },
  fallbackGeometry: { ceilingHeight: 2.85, halfWidth: 3.2, wallThickness: 0.12, doorWidth: 2.1, doorHeight: 2.5, facadeDepth: 0.48 },
} as const;
```

- [ ] **Step 4: Run the focused test far enough to reach consumer assertions**

Expected: FAIL because core modules still own hard-coded values.

### Task 2: Connect corridor modules to the config

**Files:**
- Modify: `src/core/ward-corridor-model.ts`
- Modify: `src/core/ward-corridor-camera.ts`
- Modify: `src/core/area-corridor-controls.ts`
- Modify: `src/core/area-scene.ts`
- Modify: `src/core/ward-corridor-model.test.ts`
- Modify: `src/core/ward-corridor-camera.test.ts`
- Modify: `src/core/area-corridor-controls.test.ts`
- Modify: `scripts/area-scene-zoom-boundary.test.mjs`
- Modify: `scripts/area-scene-visibility-boundary.test.mjs`

**Interfaces:**
- Consumes: `wardCorridorSceneConfig`
- Preserves: `WARD_CORRIDOR_MODEL_URL`, `WARD_CORRIDOR_SLOT_COUNT`, `HOSPITAL_CORRIDOR_DOOR_NAMES`, `getWardCorridorCameraView()`, and `resolveAreaCorridorControlLimits()`.

- [ ] **Step 1: Replace model-contract literals**

Keep existing exported constant names for compatibility, assigning them from `wardCorridorSceneConfig.model`. Use `rotationX` during normalization and use configured door names and slot count in binding helpers.

- [ ] **Step 2: Replace camera and control literals**

Read GLB bounds coefficients from `camera.modelBoundsView`; read open polar/azimuth/distance limits from `controls`; preserve the existing formulas.

- [ ] **Step 3: Replace `AreaScene` high-level corridor literals**

Read background, FOV thresholds, interaction speeds, and fallback geometry dimensions from config. Keep room data, door screens, and generated fallback algorithms in `AreaScene`.

- [ ] **Step 4: Run focused corridor tests**

Run:

```bash
node scripts/ward-corridor-scene-config-boundary.test.mjs
node --experimental-strip-types --test src/core/ward-corridor-model.test.ts src/core/ward-corridor-camera.test.ts src/core/area-corridor-controls.test.ts
node --test scripts/area-scene-zoom-boundary.test.mjs scripts/area-scene-visibility-boundary.test.mjs
```

Expected: all pass.

### Task 3: Document corridor model and scene configuration

**Files:**
- Create: `docs/model-guides/ward-corridor-model-configuration.md`
- Modify: `docs/model-guides/README.md`

**Interfaces:**
- Consumes: exact field names from `wardCorridorSceneConfig`.

- [ ] **Step 1: Write the guide**

Document GLB placement, `model.url` cache versioning, Blender/Three.js axis conversion, the six required door node names, slot-count invariant, camera fields, control fields, fallback dimensions, test commands, and visual acceptance steps.

- [ ] **Step 2: Add the guide to the model documentation index**

Add a Markdown link from `docs/model-guides/README.md`.

- [ ] **Step 3: Run corridor config and documentation checks**

Run the focused config test and verify all referenced paths exist.
