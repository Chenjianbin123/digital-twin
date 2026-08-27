# Hide Nurse Station Room Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the room-status floating markers from the nurse station while preserving all other nurse-station controls and information.

**Architecture:** Keep `NurseStationVisualScene.vue` as the scene owner, but remove only the marker presentation concern: marker selection imports, display configuration, markup, and marker-only styles. Add a zero-dependency source contract test because this project has no Vue component test framework.

**Tech Stack:** Vue 3 SFC, TypeScript, SCSS, Node.js built-in test runner, Vite

## Global Constraints

- Preserve the nurse-station 3D scene, area caption, corridor-entry button, and overlay visibility behavior.
- Do not remove shared room-summary or marker-selection core modules.
- Add no dependencies.

---

### Task 1: Remove Nurse Station Room Markers

**Files:**
- Create: `scripts/nurse-station-room-markers-hidden.test.mjs`
- Modify: `src/components/NurseStationVisualScene.vue`

**Interfaces:**
- Consumes: the source text of `src/components/NurseStationVisualScene.vue`
- Produces: a nurse-station component without the `重点病房` marker layer or `.room-marker` styles

- [ ] **Step 1: Write the failing source contract test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentUrl = new URL('../src/components/NurseStationVisualScene.vue', import.meta.url);

test('nurse station does not render room status markers', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.doesNotMatch(source, /aria-label="重点病房"/);
  assert.doesNotMatch(source, /class="room-marker"/);
  assert.doesNotMatch(source, /selectNurseStationMarkers/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test scripts/nurse-station-room-markers-hidden.test.mjs`

Expected: FAIL because `NurseStationVisualScene.vue` still contains `aria-label="重点病房"`.

- [ ] **Step 3: Remove marker-only component code**

Remove the `computed` and marker-selector imports, `RoomPriority` type import, `markers`, `markerSlots`, `priorityLabel`, `markerStyle`, the marker template block, `.nurse-station-visual__markers`, `.room-marker`, `@keyframes marker-pulse`, and marker-specific responsive/reduced-motion rules. Preserve all other template nodes and styles.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test scripts/nurse-station-room-markers-hidden.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript checking and Vite production build both complete successfully.

- [ ] **Step 5: Visually verify the nurse station**

Start the existing Vite application and confirm the nurse-station room markers are absent while the area caption and corridor-entry button remain visible.

No commit step is included because the project directory does not contain Git metadata.
