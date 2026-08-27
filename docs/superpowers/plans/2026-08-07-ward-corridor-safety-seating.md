# Ward Corridor Safety Seating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hospital safety signs and two staggered waiting benches to the approved 4-meter ward corridor concept render.

**Architecture:** Extend the existing procedural Blender scene script with a reusable bench builder and wall-mounted Chinese sign builder. Keep all additions inside the concept scene generator so the generated PNG and `.blend` remain reproducible.

**Tech Stack:** Python, Blender 5.1.2, `bpy`, EEVEE

## Global Constraints

- Keep the corridor clear width at least approximately 2.4 meters.
- Do not obstruct ward doors, dynamic door screens, handrails, or the evacuation route.
- Use Chinese-only visible copy.
- Do not change the existing dynamic door-screen interface/template contract.
- Do not replace the production GLB during this preview task.

---

### Task 1: Add reusable seating and sign geometry

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`

**Interfaces:**
- Consumes: existing `box`, `cylinder`, `add_text`, and material helpers.
- Produces: `add_waiting_bench(name, side, y, mats)` and `add_wall_safety_sign(name, text, side, y, mats)`.

- [x] **Step 1: Add geometry validation**

Add assertions for two three-seat benches, three safety signs, and one exit sign in the generated scene.

- [x] **Step 2: Run Blender and verify the assertions fail**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_smart_ward_corridor_concept.py`

Expected: the new object-count assertions fail before the geometry exists.

- [x] **Step 3: Implement the reusable builders**

Create compact three-seat benches with soft seat/back pads and metal supports. Create wall signs with a framed backing and Chinese text facing the corridor.

- [x] **Step 4: Place the approved scene elements**

Place two benches on opposite walls at staggered longitudinal positions. Add `保持安静`, `禁止吸烟`, `小心地滑`, and `安全出口 →` without covering doors or door screens.

- [x] **Step 5: Render and verify**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_smart_ward_corridor_concept.py`

Expected: exit code 0; updated PNG and `.blend` files are written under `docs/superpowers/previews/`.

- [x] **Step 6: Inspect the 1600×900 preview**

Confirm the chairs and Chinese signs are visible, the central route remains open, and no ceiling or wall artifacts appear.
