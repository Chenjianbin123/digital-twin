# Ward Corridor Final Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the seven approved visual and interaction-structure refinements to the reproducible Blender ward-corridor concept scene.

**Architecture:** Extend the existing single Blender scene generator with small reusable geometry helpers and a post-build collection organizer. Add scene assertions before saving so missing visual elements or interaction collections stop generation before an invalid preview is written.

**Tech Stack:** Python, Blender 5.1.2, `bpy`, EEVEE

## Global Constraints

- Preserve at least approximately 2.4 meters of clear central corridor width.
- Do not show a nurse station or open ward doors.
- Preserve the independent dynamic door-screen surfaces and existing project template/API contract.
- Visible copy must contain only Chinese and room numbers.
- Update only the concept generator, PNG preview, and Blender source; do not replace the production GLB.

---

### Task 1: Add failing scene acceptance checks

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`

**Interfaces:**
- Consumes: `bpy.context.scene.objects` and `bpy.data.collections`.
- Produces: expanded `validate_safety_seating_layout()` assertions for room numbers, seams, window shades, ceiling equipment, seat seams, and interaction collections.

- [x] **Step 1: Assert all approved elements and collections exist**

Require 10 room-number texts, 6 seat-seam details, at least 10 floor seams, 5 window shade slats, smoke detectors, one dome camera, one access panel, and the six named interaction collections.

- [x] **Step 2: Run Blender and observe the expected failure**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_smart_ward_corridor_concept.py`

Expected: assertion failure reporting the first missing refinement element.

### Task 2: Implement the seven model refinements

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`

**Interfaces:**
- Consumes: existing `box`, `cylinder`, `add_text`, `add_wall_text`, `add_waiting_bench`, `add_wall_safety_sign`, and `add_door_module` helpers.
- Produces: refined materials and geometry plus `organize_interaction_collections()`.

- [x] **Step 1: Refine seating and safety signs**

Darken the medical upholstery, add one seam detail per seat pad, reduce sign dimensions by approximately 15%, and keep all sign text at one mounting height.

- [x] **Step 2: Add room numbers and floor seams**

Generate room numbers `301` through `310` as independent text objects and add subtle transverse medical-vinyl seams at two-meter intervals.

- [x] **Step 3: Refine the end window and ceiling**

Reduce window emission and daylight energy, add five horizontal frosted shade slats, two smoke detectors, one dome camera, and one ceiling access panel.

- [x] **Step 4: Organize Blender interaction collections**

Move generated objects into the six named collections and set `interaction_role` to `ward-door`, `door-screen`, `room-number`, `seating`, `safety-sign`, or `ceiling-equipment` as appropriate.

- [x] **Step 5: Render and verify**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_smart_ward_corridor_concept.py`

Expected: exit code 0 with no assertion traceback; updated PNG and `.blend` are written to `docs/superpowers/previews/`.

- [x] **Step 6: Inspect the final 1600×900 image**

Confirm the window retains detail, room numbers and floor seams are visible without clutter, ceiling additions remain restrained, signs are consistent, and the central route stays clear.
