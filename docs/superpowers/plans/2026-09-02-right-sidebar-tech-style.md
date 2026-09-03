# Right Sidebar Tech Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the right sidebar presentation across nurse-station, ward-corridor, and ward-interior scenes with a translucent glass surface, restrained sci-fi decoration, and accessible motion.

**Architecture:** Keep the existing `digital-twin__panel` wrapper as the shared visual boundary. Add the glass, grid, edge-light, and entry/scan animations in `src/App.vue`, while preserving each child panel's data and scene-specific layout. Protect the effect with a reduced-motion media query and verify the boundary through a source-level test.

**Tech Stack:** Vue 3, scoped SCSS, Node.js built-in test runner, Vite.

## Global Constraints

- Preserve all existing sidebar content, events, responsive breakpoints, and scene-specific widths.
- Use transparent backgrounds with `backdrop-filter`; do not add dependencies or change Three.js/model logic.
- Respect `prefers-reduced-motion: reduce`.
- Keep the right sidebar interactive while decorative layers remain pointer-transparent.

### Task 1: Add the right-sidebar style boundary test

**Files:**
- Create: `scripts/right-sidebar-tech-style-boundary.test.mjs`

- [x] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

test('all scene sidebars use a translucent animated glass shell', () => {
  assert.match(app, /&__panel\s*\{/);
  assert.match(app, /backdrop-filter:\s*blur\(/);
  assert.match(app, /digital-panel-enter/);
  assert.match(app, /digital-panel-scan/);
  assert.match(app, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
```

- [x] **Step 2: Run the test and confirm it fails**

Run: `node --test scripts/right-sidebar-tech-style-boundary.test.mjs`

Expected: FAIL because the shared panel does not yet contain the new animation names.

### Task 2: Implement the shared glass-tech sidebar shell

**Files:**
- Modify: `src/App.vue` in the `.digital-twin__panel` SCSS block.

- [x] **Step 1: Add the shared variables and translucent shell**

Use the existing wrapper and preserve its width/breakpoint rules while adding:

```scss
--panel-glass-alpha: 0.46;
background:
  linear-gradient(180deg, rgba(7, 24, 43, 0.66), rgba(3, 14, 27, 0.46)),
  rgba(6, 18, 32, var(--panel-glass-alpha));
backdrop-filter: blur(16px) saturate(135%);
-webkit-backdrop-filter: blur(16px) saturate(135%);
isolation: isolate;
animation: digital-panel-enter 0.52s cubic-bezier(0.22, 0.8, 0.24, 1) both;
```

- [x] **Step 2: Add pointer-transparent edge and grid decoration**

Keep the existing top rule semantics, but add a moving edge glow and a subtle grid through `::before` and `::after`; both layers must set `pointer-events: none` and stay below child content with `z-index: 0`.

- [x] **Step 3: Tune station and overlay variants**

Keep scene differences but make both variants transparent and animated:

```scss
&--station {
  --panel-glass-alpha: 0.42;
  background:
    linear-gradient(180deg, rgba(7, 22, 39, 0.62), rgba(5, 15, 27, 0.42)),
    rgba(6, 18, 32, var(--panel-glass-alpha));
}

&--overlay {
  --panel-glass-alpha: 0.48;
}
```

- [x] **Step 4: Add reduced-motion fallback and content stacking**

Disable panel animation and decorative scan movement under reduced motion, and keep direct child content above the pseudo-elements.

### Task 3: Verify the visual boundary and build

**Files:**
- Test: `scripts/right-sidebar-tech-style-boundary.test.mjs`
- Verify: `npm run typecheck`
- Verify: `npm run build`
- Verify: `git diff --check`

- [x] **Step 1: Run the new test and related layout tests**
- [x] **Step 2: Run typecheck and production build**
- [x] **Step 3: Run whitespace verification and report any unrelated historical test failures separately**
