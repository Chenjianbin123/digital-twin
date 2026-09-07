# Dynamic Ward Beds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ward interior render one to seven interactive bed modules from the current room's API bed list.

**Architecture:** Export the current Blender ward as a prototype-mode GLB: static architecture and props remain in place while one complete bed module is named `BedPrototype`. At runtime `WardScene` clones this module for each bed and keeps the existing JSON bed-terminal texture renderer, click selection, and status rendering attached to each clone.

**Tech Stack:** Blender, glTF/GLB, Three.js, TypeScript, Node test runner.

## Global Constraints

- Preserve the existing bed-head SN → template API → JSON template parsing flow.
- Use the actual asset URL configured in `src/config/ward-interior-scene.ts`.
- Support one through seven beds; do not render more than seven modules.
- Do not reintroduce a generated fallback room when the GLB fails.
- Preserve existing uncommitted user changes outside this feature.

---

### Task 1: Define the seven-bed model contract

**Files:**

- Modify: `src/config/ward-interior-scene.ts`
- Modify: `docs/model-guides/ward-interior-model-configuration.md`
- Test: `scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

**Interfaces:**

- Consumes: `wardInteriorSceneConfig.modelBedLayout.maxBeds`
- Produces: model capacity contract of `7`

- [ ] **Step 1: Write the failing test**

```js
assert.match(config, /maxBeds:\s*7/);
assert.match(modelGuide, /一至七张床/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

Expected: FAIL because the existing cap is six.

- [ ] **Step 3: Write minimal implementation**

```ts
modelBedLayout: {
  maxBeds: 7,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

Expected: PASS.

### Task 2: Export a prototype-mode ward GLB from Blender

**Files:**

- Create: `scripts/export_dynamic_ward_interior.py`
- Modify: `public/models/smart-ward-interior/room-v1.glb`
- Test: `scripts/validate_smart_ward_interior_glb.py`

**Interfaces:**

- Consumes: Blender source `smart_ward_scene_highres.blend`
- Produces: GLB nodes `WardArchitecture`, `WardProps`, `BedPrototype`, `Bed_1_Mattress`, `SmartBedhead_1_Status`, and `BedTerminalSurface`

- [ ] **Step 1: Write the failing test**

Run the existing GLB validator after adding a check for prototype nodes:

```py
assert "BedPrototype" in object_names
assert "Bed_1_Mattress" in object_names
assert "BedTerminalSurface" in object_names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 scripts/validate_smart_ward_interior_glb.py`

Expected: FAIL because the existing GLB is baked-mode.

- [ ] **Step 3: Write minimal implementation**

Create the named static and bed-module groups from existing scene objects, hide the source bed module from the exported static scene, and export to the active `room-v1.glb` asset path.

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 scripts/validate_smart_ward_interior_glb.py`

Expected: PASS with prototype nodes detected.

### Task 3: Bind all API beds to cloned prototype modules

**Files:**

- Modify: `src/core/ward-scene.ts`
- Test: `scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

**Interfaces:**

- Consumes: `TwinWardEntity.beds`
- Produces: one `BedMeshGroup` per distinct bed code, maximum seven

- [ ] **Step 1: Write the failing test**

```js
assert.match(wardScene, /const dynamicBeds = ward\.beds\.slice\(0, WARD_INTERIOR_MAX_BEDS\)/);
assert.match(wardScene, /this\.createModelBedMesh\(bed, index, dynamicBeds\.length\)/);
assert.doesNotMatch(createBedMesh, /index < this\.wardInteriorParts\.bakedBeds\.length/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

Expected: FAIL because the existing baked path drops bed indexes above the baked model count.

- [ ] **Step 3: Write minimal implementation**

Use a shared seven-bed capacity constant; process a capped current-bed list consistently when creating, positioning, refreshing terminal textures, syncing selection, and calculating room size.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`

Expected: PASS.

### Task 4: Verify runtime and build integration

**Files:**

- Test: `scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs`
- Test: `scripts/ward-interior-model-integration-boundary.test.mjs`
- Test: `src/core/ward-interior-model.test.ts`
- Test: `src/core/ward-scene-controls.test.ts`

- [ ] **Step 1: Run targeted checks**

```bash
node --test scripts/ward-interior-dynamic-bed-capacity-boundary.test.mjs scripts/ward-interior-model-integration-boundary.test.mjs
node --experimental-strip-types --test src/core/ward-interior-model.test.ts src/core/ward-scene-controls.test.ts
```

- [ ] **Step 2: Run project checks**

```bash
npm run typecheck
npm run build
git diff --check
```

- [ ] **Step 3: Perform visual asset inspection**

Render or inspect the exported GLB to confirm static room geometry remains separate from the single bed prototype and no fixed duplicate beds remain in the static scene.
