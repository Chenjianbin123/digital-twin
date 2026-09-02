# Bed Template Parser Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution selected for this task). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the digital-twin ward bed data chain and CanvasTexture template parsing with the production `medical-device-v2` bed terminal flow.

**Architecture:** Keep door devices as the source for ward/room discovery and door-screen data, but load every bed terminal by its discovered SN and use `queryBedDeviceInfo` as the authoritative source for bed metadata, patient data, nursing labels, online state, and `templateId`. Parse each unique template through the existing cache and render the transformed AST onto the existing Three.js CanvasTexture surface, preserving the current scene and fallback behavior.

**Tech Stack:** Vue 3, Pinia, TypeScript, Three.js CanvasTexture, Node test runner, Vite.

## Global Constraints

- The bed endpoint remains `POST device/bedDevice/queryBaseDeviceInfo`.
- Bed requests must include `deviceCode`, `apkSystemType`, and `menuMode`, matching `medical-device-v2`.
- Bed template IDs must come from `bedDeviceInfoVo.templateId`, never from `doorDeviceInfo.templateId`.
- Bed patient data must prefer `bedSickInfoVo`; door patient data remains only a discovery/fallback source.
- Template content is read from `templateContent`, parsed as JSON, and rejected when `isNew !== true`.
- Existing Three.js scene/model and user-made UI/model changes must remain intact.
- Every behavior change gets a failing test before production code, then a fresh passing test and full verification.

---

### Task 1: Expand the bed-device contract and create authoritative bed mapping

**Files:**
- Modify: `src/types/bed-device.ts`
- Modify: `src/types/ward.ts`
- Modify: `src/types/twin.ts`
- Modify: `src/mock/bed-device-info.ts`
- Modify: `src/api/bed-device.ts`
- Modify: `src/services/bed-template-enricher.ts`
- Create: `src/services/bed-device-loader.ts`
- Test: `src/core/bed-device-loader.test.ts`

**Interfaces:**
- `queryBedDeviceInfo(deviceCode: string): Promise<BedDeviceInfoData>` returns `bedDeviceInfoVo`, `bedSickInfoVo`, and `bedSickNursingLabelList`.
- `loadBedDeviceDetails(beds, isCurrent?)` resolves all bed SNs and returns `{ warnings, loaded }`.
- `applyBedDeviceInfoToTwinBed(bed, data)` mutates only the supplied bed with authoritative bed data.

- [ ] **Step 1: Write the failing test**

```ts
test('maps bed terminal patient and nursing labels from bed endpoint data', async () => {
  const bed = createTwinBed('SN1001', '90101', '01');
  const result = applyBedDeviceInfoToTwinBed(bed, {
    bedDeviceInfoVo: { ...deviceInfo, deviceCode: 'SN1001', bedCode: '90101', bedName: '01', templateId: 42 },
    bedSickInfoVo: { sickName: '床头患者', sickNo: 'A-1', nursingLevel: '一级护理', nursingColor: '#ff0000' },
    bedSickNursingLabelList: [{ labelCode: 'fall', labelName: '防跌倒', labelColor: '#ff9800' }],
  });

  assert.equal(result.templateId, 42);
  assert.equal(result.sickInfo?.sickName, '床头患者');
  assert.equal(result.sickInfo?.sickNo, 'A-1');
  assert.deepEqual(result.nursingLabels?.map(item => item.labelCode), ['fall']);
  assert.equal(result.isOccupied, true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test src/core/bed-device-loader.test.ts
```

Expected: FAIL because the authoritative bed mapping and loader do not exist.

- [ ] **Step 3: Implement the minimal contract and loader**

Add the production fields from `medical-device-v2` to `BedDeviceInfoData`, normalize optional/null values, convert the original `BedSickInfoVo` into the existing `DoorSickInfo` shape without losing extra fields, and make `queryBedTemplateId` delegate to the full response instead of issuing a second request. `loadBedDeviceDetails` must de-duplicate SNs, run requests with `Promise.allSettled`, update only beds whose device codes still match, and return per-device warnings.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --test src/core/bed-device-loader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor without changing behavior**

Keep the mapping helpers pure and move cache ownership into `bed-device-loader.ts`; retain `clearBedTemplateIdCache` as a compatibility export that clears the new response cache.

### Task 2: Preload authoritative bed data during area loading

**Files:**
- Modify: `src/stores/twin-store.ts`
- Modify: `src/api/database-twin.ts`
- Modify: `src/core/real-area-reconcile.ts`
- Modify: `scripts/bed-device-load-timing.test.mjs`
- Create: `src/core/bed-area-preload.test.ts`

**Interfaces:**
- `fetchAreaSnapshot` returns an area whose beds are enriched before the snapshot is committed.
- `loadCurrentWardBedDetails` remains available for refresh/retry, but is no longer the first place bed data is requested.

- [ ] **Step 1: Write the failing test**

```ts
test('area snapshot enriches every discovered bed before it is committed', async () => {
  const snapshot = await buildSnapshotWithBedDetails();
  assert.equal(snapshot.area.rooms[0].beds[0].templateId, 42);
  assert.equal(snapshot.area.rooms[0].beds[0].sickInfo?.sickName, '床头患者');
  assert.equal(snapshot.area.rooms[0].beds[1].templateId, 43);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test src/core/bed-area-preload.test.ts scripts/bed-device-load-timing.test.mjs
```

Expected: FAIL because area loading currently commits door-derived beds and defers bed requests until entering a room.

- [ ] **Step 3: Implement area-level enrichment**

After door discovery/detail mapping and before returning `AreaSnapshot`, call `loadBedDeviceDetails` for all rooms. Merge warnings into `dataWarnings`, preserve the last valid room during refresh, and guard stale requests with the existing area request token. Database-backed snapshots must use the same normalizer when bed device codes are present; no door template ID may be copied onto a bed.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
node --test src/core/bed-area-preload.test.ts scripts/bed-device-load-timing.test.mjs
```

Expected: PASS, with no assertion that bed loading only occurs on room entry.

- [ ] **Step 5: Refactor and preserve retry behavior**

Use the existing `loadCurrentWardBedDetails` as an explicit retry path for a failed/partial preload and keep `bedDetailsLoading`/`bedDetailsError` reactive for that retry.

### Task 3: Match ParserV3 template semantics and CanvasTexture rendering

**Files:**
- Modify: `src/types/template.ts`
- Modify: `src/core/template/template-validation.ts`
- Modify: `src/core/template/parser.ts`
- Modify: `src/core/template/data-mapper.ts`
- Modify: `src/core/template/canvas-renderer.ts`
- Modify: `src/core/template/template-cache.ts`
- Create: `src/core/template-parser-v3-alignment.test.ts`

**Interfaces:**
- `parseTemplateInfo(info)` rejects old templates and returns root-level percentage coordinates.
- `resolveNodeText(node, data)` supports comma-separated paths such as `bedSickInfoVo,sickName`, `timer,date`, and `bedDeviceInfoVo,bedName`.
- Nested `children` are recursively transformed/rendered relative to their parent rectangle.
- `hosDate` formats the bed admission timestamp as `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests**

```ts
test('rejects an old ParserV3 template', () => {
  assert.throws(
    () => parseTemplateInfo({ id: 1, analyzeType: '1', templateContent: JSON.stringify({
      width: 1024, height: 600, isNew: false, data: [{ type: 'text', left: 10, top: 10, width: 100, height: 30 }],
    }) }),
    /暂不支持旧模板/,
  );
});

test('transforms nested nodes and resolves comma paths from bed data', () => {
  const parsed = parseTemplateInfo({ id: 1, analyzeType: '1', templateContent: JSON.stringify({
    width: 1000, height: 500, isNew: true,
    data: [{ id: 'card', type: 'element', left: 100, top: 50, width: 400, height: 200,
      children: [{ id: 'name', type: 'text', left: 10, top: 10, width: 50, height: 20, key: 'bedSickInfoVo,sickName' }],
    }],
  }) });
  const child = parsed.nodes[0].children?.[0] as TemplateNode;
  assert.equal(parsed.nodes[0].left, '10.000');
  assert.equal(child.left, '10.000');
  assert.equal(resolveNodeText(child, buildBedTemplateData(createBedWithPatient())), '床头患者');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test src/core/template-parser-v3-alignment.test.ts
```

Expected: FAIL because old templates are not rejected and nested nodes are not transformed/rendered.

- [ ] **Step 3: Implement the minimal ParserV3-compatible transformation**

Normalize IDs, validate `templateContent`, reject `isNew !== true`, convert only root children for pixel templates, preserve percentage templates, recursively transform child trees, retain `zIndex`, and keep `doorInfoBox` empty-bed injection isolated to door templates. Extend `TemplateNode` metadata for `$absoluteWidth`, `$adjustFont`, and parent references without exposing Vue-specific runtime objects.

- [ ] **Step 4: Implement renderer support for nested nodes and dynamic images**

Render root nodes sorted by `zIndex`, recurse through array/object children using parent-relative percentages, support `objectFit: contain`, use `bedSickInfoVo` QR data when a real QR image is not available, and keep fallback placeholders for unavailable images. Do not render interactive button/svgBox nodes onto the bed screen.

- [ ] **Step 5: Run focused tests and verify they pass**

Run:

```bash
node --test src/core/template-parser-v3-alignment.test.ts src/core/template-parser-validation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Refactor cache signatures**

Include `analyzeType`, `templateContent`, and `isNew` in the parsed-template signature so a backend template update cannot reuse stale AST coordinates.

### Task 4: Wire bed templates to the enriched data and verify the full project

**Files:**
- Modify: `src/core/ward-scene.ts`
- Modify: `src/core/template/bed-terminal-texture.ts`
- Modify: `src/core/bed-status.ts` only if the authoritative online/status mapping requires it
- Add regression assertions to: `src/core/ward-interior-model.test.ts` or `src/core/bed-device-loader.test.ts`

**Interfaces:**
- `WardScene.syncWardBedTemplates` calls `loadParsedTemplate(bed.templateId)` for each enriched bed and renders the corresponding patient data.
- A missing bed template produces an explicit fallback texture and warning state, never a door template.

- [ ] **Step 1: Write the failing regression test**

```ts
test('bed terminal rendering uses each bed template id independently', async () => {
  const beds = [createBedWithTemplate(11, 'SN1001'), createBedWithTemplate(12, 'SN1002')];
  const templateIds = beds.map(bed => bed.templateId);
  assert.deepEqual(templateIds, [11, 12]);
  assert.notEqual(templateIds[0], 3);
});
```

- [ ] **Step 2: Run the focused regression test and verify it fails**

Run:

```bash
node --test src/core/bed-device-loader.test.ts
```

Expected: FAIL until the full bed mapping is used by the scene path.

- [ ] **Step 3: Implement the scene integration**

Keep the existing loading/error/missing textures, but source all displayed patient fields through `buildBedTemplateData(bed)` after enrichment. Trigger a texture refresh after area commit and after an explicit bed-detail retry; do not make the renderer query the door device or invent patient data.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, `vue-tsc` exits 0, and Vite produces a fresh `dist` build.

- [ ] **Step 5: Review the plan against the implementation**

Confirm the six global constraints, inspect `git diff`, and report any backend fields that remain unavailable without claiming they are present.
