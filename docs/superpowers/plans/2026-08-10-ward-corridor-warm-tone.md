# Ward Corridor Warm Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift the approved ward corridor toward a restrained 4000K warm medical palette while retaining cool information accents.

**Architecture:** Update only material and light color parameters in the reproducible Blender scene generator. Extend the existing scene validator with warm-palette constraints before applying the new values.

**Tech Stack:** Python, Blender 5.1.2, `bpy`, EEVEE

## Global Constraints

- Increase perceived warmth by approximately 10%.
- Keep the end window, dynamic door screens, and safety-exit green cooler than the main architectural surfaces.
- Do not change scene geometry, interaction collections, or the production GLB.

---

### Task 1: Add warm-palette acceptance checks

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`

- [x] **Step 1: Assert warm architectural surfaces and lights**

Require wall and floor base colors to contain more red than blue, require the primary area light to use a restrained warm-white color, and require the window material to remain cooler than the wall.

- [x] **Step 2: Run Blender and verify the current cool palette fails**

Run: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_smart_ward_corridor_concept.py`

Expected: assertion failure reporting the cool wall or floor palette.

### Task 2: Apply and verify the warm medical palette

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`

- [x] **Step 1: Warm the architecture and seating**

Adjust ceiling, wall, panel, floor, door, guide strip, seat, and floor-seam colors without changing geometry.

- [x] **Step 2: Set restrained 4000K lighting**

Warm the ceiling-light material, area-light color, sun color, and world background while retaining cool end-window light.

- [x] **Step 3: Render and inspect**

Run the Blender generator, confirm no assertion traceback, then visually inspect the 1600×900 output for neutral warmth without yellow contamination.
