# Ward Corridor GLB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the corridor phase with the approved GLB while preserving live room data, template-rendered door screens, room entry, and a generated fallback.

**Architecture:** Export named dynamic surfaces from Blender, load the GLB asynchronously in `AreaScene`, and map up to ten `TwinWardEntity` records to model slots. Keep the current generated corridor active until the GLB is usable and whenever room count exceeds ten.

**Tech Stack:** Blender 5.1.2, Python, Vue 3, TypeScript, Three.js, GLTFLoader, CanvasTexture

## Global Constraints

- Keep `VITE_DATA_SOURCE=remote` as the default.
- Preserve existing door-template parsing and room-interior navigation.
- Empty model slots display `空床` and are not clickable.
- More than 10 rooms or GLB load failure uses the generated corridor.
- Do not replace the nurse-station GLB.

---

### Task 1: Define and test corridor slot mapping

**Files:**
- Create: `src/core/ward-corridor-model.ts`
- Create: `src/core/ward-corridor-model.test.ts`

- [ ] Write Node tests for 10-slot mapping, `空床`, interactivity, object-name parsing, and generated fallback above 10 rooms.
- [ ] Run the tests with Node type stripping and confirm they fail because the helper does not exist.
- [ ] Implement the pure mapping helpers and rerun the tests.

### Task 2: Add live Blender surfaces and export GLB

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`
- Create: `public/models/smart-ward-corridor/smart_ward_corridor.glb`

- [ ] Add ten named live screen planes and ten named room-label planes to the Blender generator.
- [ ] Extend Blender validation for all dynamic surfaces.
- [ ] Export the scene without cameras and lights to the project model directory.
- [ ] Import the GLB in Blender background mode and verify all required object names exist.

### Task 3: Integrate the GLB into AreaScene

**Files:**
- Modify: `src/core/area-scene.ts`

- [ ] Load and normalize the GLB asynchronously while retaining the generated fallback.
- [ ] Bind room records to door, label, and screen meshes; render `空床` for unbound slots.
- [ ] Reuse `renderDoorTerminalTexture` for bound screens and refresh on data changes.
- [ ] Route GLB door clicks and focus transitions to the existing room callbacks.
- [ ] Dispose dynamic textures and GLB materials safely.

### Task 4: Add 301–310 simulation data

**Files:**
- Modify: `src/mock/room-factory.ts`
- Modify: `src/mock/door-device-list.ts`

- [ ] Generate ten rooms with stable room, bed, device, patient, environment, and status identifiers.
- [ ] Keep existing mock API response contracts unchanged.

### Task 5: Verify and run

**Files:**
- Verify: `src/core/ward-corridor-model.test.ts`
- Verify: `public/models/smart-ward-corridor/smart_ward_corridor.glb`

- [ ] Run focused slot-mapping tests.
- [ ] Run `npm run build`.
- [ ] Start a mock-mode preview without changing `.env.development`.
- [ ] Verify the GLB, ten dynamic labels/screens, door click behavior, console logs, and desktop/mobile layout in the browser.
