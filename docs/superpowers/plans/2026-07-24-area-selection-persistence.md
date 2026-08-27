# Area Selection Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the last successfully entered ward after a page refresh and keep the ward-selection page fixed to the application viewport with internal overflow scrolling.

**Architecture:** The area-access core distinguishes a genuinely remembered ward from the existing preferred/highlight fallback. The Pinia store validates local persistence against the current permitted ward list, while the startup orchestrator reuses `enterArea(areaId)` to restore valid ward data atomically. The selection view remains the only scroll container because the global application shell keeps document scrolling disabled.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, SCSS, Node 24 type-stripping assertion scripts

## Global Constraints

- Only a ward ID that was actually persisted and remains in the current accessible ward list may trigger automatic entry.
- First-time users must remain on the ward-selection page; the configured ward or first list item is highlight-only.
- Automatic restoration returns to the nurse station and does not restore room, bed, camera, or drawer state.
- Invalid or inaccessible persisted IDs are removed; transient ward-data failures keep the persisted ID and expose the existing selection-page error.
- Ward, device, patient, and bed data must still be reloaded from the real interfaces after every page refresh.
- Database and mock data-source startup behavior remains unchanged.
- The selection page has one vertical scroll container and does not expand the outer application.
- Do not add dependencies, routing, authentication, or a persistence toggle.
- The workspace is not a Git repository, so commit steps are omitted.

---

### Task 1: Remembered Ward Validation

**Files:**
- Modify: `scripts/hospital-area.test.ts`
- Modify: `scripts/task-4-concurrency.test.mjs`
- Modify: `src/core/area-access.ts`
- Modify: `src/stores/twin-store.ts`

**Interfaces:**
- Consumes: `HospAreaRecord[]` and `window.localStorage`.
- Produces: `resolveRememberedAreaId(areas, storedId): number | null` and store ref `rememberedAreaId`.

- [ ] **Step 1: Write failing pure resolver assertions**

Extend `scripts/hospital-area.test.ts`:

```ts
import {
  allowAllAreaAccessPolicy,
  resolvePreferredAreaId,
  resolveRememberedAreaId,
} from '../src/core/area-access.ts';

assert.equal(resolveRememberedAreaId(areas, '192'), 192);
assert.equal(resolveRememberedAreaId(areas, '99'), null);
assert.equal(resolveRememberedAreaId(areas, null), null);
assert.equal(resolveRememberedAreaId(areas, 'invalid'), null);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types scripts/hospital-area.test.ts`

Expected: non-zero exit because `resolveRememberedAreaId` is not exported.

- [ ] **Step 3: Implement the remembered-area resolver**

Add to `src/core/area-access.ts`:

```ts
export function resolveRememberedAreaId(
  areas: HospAreaRecord[],
  storedId?: string | number | null,
): number | null {
  if (storedId == null || String(storedId).trim() === '')
    return null;
  const id = Number(storedId);
  if (!Number.isInteger(id) || id <= 0)
    return null;
  return areas.some(area => area.id === id) ? id : null;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --experimental-strip-types scripts/hospital-area.test.ts`

Expected: exit 0 with all assertions passing.

- [ ] **Step 5: Write a failing store persistence test**

Extend the local-storage test double in `scripts/task-4-concurrency.test.mjs`:

```js
removeItem: key => localStorageValues.delete(key),
```

Add a test that returns one available ward while persistence points to a removed ward:

```js
await run('invalid remembered area is cleared without auto-selecting a fallback', async () => {
  const storageKey = 'ward-digital-twin:last-area-id';
  localStorageValues.set(storageKey, '999');
  globalThis.fetch = async () => apiResponse({
    code: 200,
    data: {
      records: [{ id: 1, areaName: 'A病区', areaCode: 'A', isEnable: '1' }],
      pages: 1,
    },
  });
  setActivePinia(createPinia());
  const store = useTwinStore();

  await store.loadAreaOptions();

  assert.equal(store.rememberedAreaId, null);
  assert.equal(store.preferredAreaId, 1);
  assert.equal(localStorageValues.has(storageKey), false);
});
```

- [ ] **Step 6: Run the store test and verify RED**

Run: `node scripts/task-4-concurrency.test.mjs`

Expected: the new test fails because `rememberedAreaId` does not exist and the stale key is not removed.

- [ ] **Step 7: Add remembered state and stale-key cleanup**

Update imports and state in `src/stores/twin-store.ts`:

```ts
import {
  allowAllAreaAccessPolicy,
  resolvePreferredAreaId,
  resolveRememberedAreaId,
} from '@/core/area-access';

const rememberedAreaId = ref<number | null>(null);
```

Update `loadAreaOptions()` after the permitted list is assigned:

```ts
const storedId = typeof window === 'undefined'
  ? null
  : window.localStorage.getItem(AREA_STORAGE_KEY);
rememberedAreaId.value = resolveRememberedAreaId(areas, storedId);
preferredAreaId.value = resolvePreferredAreaId(areas, storedId, getAreaId());
if (typeof window !== 'undefined' && storedId != null && rememberedAreaId.value == null)
  window.localStorage.removeItem(AREA_STORAGE_KEY);
```

Reset `rememberedAreaId` in the error branch and expose it in the returned store API. When `commitRequestedArea()` succeeds, assign `rememberedAreaId.value = areaId` alongside `selectedAreaId` before persisting.

- [ ] **Step 8: Run focused tests and verify GREEN**

Run:

```bash
node --experimental-strip-types scripts/hospital-area.test.ts
node scripts/task-4-concurrency.test.mjs
```

Expected: both commands exit 0; the concurrency script reports no `FAIL` lines.

---

### Task 2: Startup Auto-Restore

**Files:**
- Modify: `scripts/area-selection-bootstrap.test.ts`
- Modify: `src/core/area-selection-bootstrap.ts`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: store ref `rememberedAreaId` and action `enterArea(areaId): Promise<boolean>` from Task 1.
- Produces: optional automatic ward restoration within `prepareAreaSelection(options)` after the ward list loads.

- [ ] **Step 1: Write failing startup-order assertions**

Extend every `prepareAreaSelection` test option with:

```ts
getRememberedAreaId: () => null,
async enterRememberedArea() {},
```

For the successful remote case, return `192`, record the entered ID, and require these final calls:

```ts
'58:同步可用病区',
'areas',
'74:恢复上次工作病区',
'enter:192',
```

Keep the local-mode expectation unchanged so it proves mock/database-style startup does not restore a ward.

- [ ] **Step 2: Run the bootstrap test and verify RED**

Run: `node --experimental-strip-types scripts/area-selection-bootstrap.test.ts`

Expected: assertion failure because the current bootstrap never calls `enterRememberedArea`.

- [ ] **Step 3: Extend the bootstrap contract and orchestration**

Update `AreaSelectionBootstrapOptions`:

```ts
getRememberedAreaId: () => number | null;
enterRememberedArea: (areaId: number) => Promise<unknown>;
```

After `await options.loadAreaOptions()` in `prepareAreaSelection()`:

```ts
if (options.useRemoteDeviceApi) {
  const rememberedAreaId = options.getRememberedAreaId();
  if (rememberedAreaId != null) {
    options.onPhase(74, '恢复上次工作病区');
    await options.enterRememberedArea(rememberedAreaId);
  }
}
```

- [ ] **Step 4: Wire the App startup to the existing store action**

Extend the options passed in `src/App.vue`:

```ts
getRememberedAreaId: () => store.rememberedAreaId,
enterRememberedArea: areaId => store.enterArea(areaId),
```

No separate scene restoration is added because successful `enterArea()` already resets the scene to `nurse-station` and starts remote services.

- [ ] **Step 5: Run bootstrap and concurrency tests and verify GREEN**

Run:

```bash
node --experimental-strip-types scripts/area-selection-bootstrap.test.ts
node scripts/task-4-concurrency.test.mjs
```

Expected: both commands exit 0 with the new restore call occurring only for the remote remembered-ward case.

---

### Task 3: Fixed Selection Height and Internal Scrolling

**Files:**
- Create: `scripts/area-selection-layout.test.mjs`
- Modify: `src/components/AreaSelectionView.vue`

**Interfaces:**
- Consumes: the fixed-height `.digital-twin` application shell.
- Produces: one viewport-bound `.area-selection` scroll container with a sticky header.

- [ ] **Step 1: Write a failing layout contract test**

Create `scripts/area-selection-layout.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/AreaSelectionView.vue', import.meta.url), 'utf8');
const rootRule = source.match(/\.area-selection\s*\{([\s\S]*?)&__header/)?.[1] ?? '';

assert.match(rootRule, /height:\s*100%\s*;/);
assert.match(rootRule, /min-height:\s*0\s*;/);
assert.match(rootRule, /overflow-x:\s*hidden\s*;/);
assert.match(rootRule, /overflow-y:\s*auto\s*;/);
assert.match(source, /&__header\s*\{[\s\S]*?position:\s*sticky\s*;/);

console.log('Area-selection layout tests passed.');
```

- [ ] **Step 2: Run the layout test and verify RED**

Run: `node scripts/area-selection-layout.test.mjs`

Expected: assertion failure because the root currently uses only `min-height: 100%` and shorthand `overflow: auto`.

- [ ] **Step 3: Implement the fixed-height scroll container**

Replace the sizing and overflow declarations in `.area-selection`:

```scss
height: 100%;
min-height: 0;
overflow-x: hidden;
overflow-y: auto;
overscroll-behavior: contain;
```

Keep the existing sticky header and responsive content rules unchanged.

- [ ] **Step 4: Run the layout test and verify GREEN**

Run: `node scripts/area-selection-layout.test.mjs`

Expected: `Area-selection layout tests passed.` and exit 0.

---

### Task 4: Integrated Verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: all outputs from Tasks 1-3.
- Produces: evidence that persistence, startup concurrency, layout, compilation, and real API loading remain valid.

- [ ] **Step 1: Run focused and regression scripts**

Run:

```bash
node --experimental-strip-types scripts/hospital-area.test.ts
node --experimental-strip-types scripts/area-selection-bootstrap.test.ts
node scripts/area-selection-layout.test.mjs
node scripts/task-4-concurrency.test.mjs
node --experimental-strip-types scripts/swp-device-query.test.ts
```

Expected: all commands exit 0 and no script reports a failed assertion.

- [ ] **Step 2: Run typecheck and production build**

Run: `npm run build`

Expected: `vue-tsc --noEmit` and `vite build` exit 0. Existing Sass deprecation and chunk-size notices are non-blocking warnings.

- [ ] **Step 3: Verify the real ward path**

Through the active Vite proxy, query the real ward list, resolve ward code `2001`, query `/swp/swp/swpDeviceInfo/querySwpDeviceInfo` with its real `areaId`, and report only business codes and counts.

Expected: ward and device business codes are `200`, and at least one door-device record is returned without printing credentials or patient data.

- [ ] **Step 4: Verify refresh restoration and scrolling visually**

With an existing valid ward persisted, reload the application at desktop and mobile viewport sizes. Confirm the startup loader transitions directly to the remembered nurse station. Clear the persistence key once to confirm the selection page remains visible, its height stays within the viewport, the page scrolls internally, the header stays visible, and the final ward plus enter button can be reached.

Expected: no content overlap, outer-page scrolling, double scrollbars, stale selection, or blank 3D scene.
