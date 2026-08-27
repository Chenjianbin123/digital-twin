# Area Selection and Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-SWP-backed ward selection page after startup and allow reliable in-session ward switching by `areaId`.

**Architecture:** A hospital-area API loads enabled wards independently from twin scene data. The Pinia store owns the selected ward, builds a complete area snapshot for a requested `areaId`, and commits it only when the request is still current; Vue components render the initial picker and switch drawer without owning data-fetching rules. Area access is routed through an allow-all policy now so a future permission provider can replace it without changing the UI.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, Three.js, SCSS, Node 24 type-stripping assertion scripts

## Global Constraints

- Use the real SWP endpoints; do not add mock ward data for this feature.
- All enabled wards are visible and switchable in this release.
- Always show the selection page after the startup animation; never auto-enter the remembered ward.
- Load door terminals only after a ward is confirmed; do not preload every ward.
- Query door terminals with `deviceTypeId: 4` and the selected `areaId`.
- Keep the old ward active until a replacement ward has loaded completely.
- A stale refresh or switch request must never overwrite a newer ward selection.
- Do not add a UI framework or an authentication/permission dependency.
- The workspace is not a Git repository, so commit steps are intentionally omitted.

---

## File Map

**Create**

- `src/types/hospital-area.ts`: SWP hospital-area request, response, and normalized record types.
- `src/core/hospital-area.ts`: pure hospital-area normalization for browser code and Node assertions.
- `src/api/hospital-area.ts`: hospital-area pagination, normalization, and real endpoint call.
- `src/core/area-access.ts`: allow-all access policy and preferred-area resolution.
- `src/core/swp-device-query.ts`: pure SWP device request-body validation and construction.
- `src/core/area-request-guard.ts`: monotonic request token used to reject stale async results.
- `src/components/AreaSelectionView.vue`: full-screen ward chooser shown after startup.
- `src/components/AreaSwitcher.vue`: current-ward switch drawer.
- `scripts/hospital-area.test.ts`: normalization, access policy, and default-selection assertions.
- `scripts/swp-device-query.test.ts`: device query contract and request-guard assertions.

**Modify**

- `src/types/swp-device.ts`: replace `current/size` query fields with the documented SWP fields.
- `src/api/swp-device.ts`: correct the relative path and require an explicit ward in the query body.
- `src/api/door-device.ts`: thread `areaId` through discovery and detail loading.
- `src/core/alert-workflow.ts`: prefix generated task IDs with the current ward scope.
- `scripts/alert-workflow.test.ts`: verify scoped task IDs do not collide.
- `src/stores/twin-store.ts`: own area options, selection, switching, snapshot commits, rollback, and refresh scoping.
- `src/services/remote-area-fetcher.ts`: refresh only the selected ward and ignore stale completion.
- `src/components/dashboard/DashboardHeader.vue`: expose the current ward as the switch trigger.
- `src/App.vue`: change boot orchestration, render picker/drawer, and route enter/switch actions.
- `.env.development`: select the existing `remote` data source for real-interface verification.

---

### Task 1: Hospital Area Contract and Access Boundary

**Files:**
- Create: `src/types/hospital-area.ts`
- Create: `src/core/hospital-area.ts`
- Create: `src/api/hospital-area.ts`
- Create: `src/core/area-access.ts`
- Create: `scripts/hospital-area.test.ts`

**Interfaces:**
- Consumes: `apiUrl(path: string)` and `postJson<T>(url, body)` from `src/api/http-client.ts`.
- Produces: `normalizeHospitalAreaRecords(records)`, `fetchHospitalAreas(): Promise<HospAreaRecord[]>`, `allowAllAreaAccessPolicy`, and `resolvePreferredAreaId(areas, storedId, configuredId)`.

- [ ] **Step 1: Write the failing area normalization and policy test**

```ts
// scripts/hospital-area.test.ts
import assert from 'node:assert/strict';
import { normalizeHospitalAreaRecords } from '../src/core/hospital-area.ts';
import {
  allowAllAreaAccessPolicy,
  resolvePreferredAreaId,
} from '../src/core/area-access.ts';

const areas = normalizeHospitalAreaRecords([
  { id: 192, areaName: ' 呼吸内科三病区 ', areaCode: 'A03', isEnable: '1' },
  { id: 193, areaName: '呼吸内科五病区', areaCode: 'A05', isEnable: '0' },
  { id: 192, areaName: '重复病区', areaCode: 'DUP', isEnable: '1' },
  { id: 0, areaName: '无效病区', areaCode: 'BAD', isEnable: '1' },
]);

assert.deepEqual(areas, [{
  id: 192,
  areaName: '呼吸内科三病区',
  areaCode: 'A03',
  areaOutCode: '',
  isEnable: '1',
}]);
assert.deepEqual(allowAllAreaAccessPolicy.filterAreas(areas), areas);
assert.equal(allowAllAreaAccessPolicy.canSwitchArea(192, 193), true);
assert.equal(resolvePreferredAreaId(areas, '192', '99'), 192);
assert.equal(resolvePreferredAreaId(areas, '99', '192'), 192);
assert.equal(resolvePreferredAreaId(areas, null, null), 192);
assert.equal(resolvePreferredAreaId([], '192', '192'), null);
```

- [ ] **Step 2: Run the test and verify the contract does not exist yet**

Run: `node --experimental-strip-types scripts/hospital-area.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/api/hospital-area.ts`.

- [ ] **Step 3: Add the hospital-area types**

```ts
// src/types/hospital-area.ts
export interface HospAreaRecord {
  id: number;
  areaName: string;
  areaCode: string;
  areaOutCode: string;
  isEnable: string;
}

export interface HospAreaRawRecord {
  id?: number | string;
  areaName?: string;
  areaCode?: string;
  areaOutCode?: string;
  isEnable?: string;
}

export interface HospAreaPageData {
  records?: HospAreaRawRecord[];
  total?: number;
  pages?: number;
  current?: number;
  size?: number;
  pageNum?: number;
  pageSize?: number;
}

export interface HospAreaQueryParams {
  areaCode: string;
  areaName: string;
  isEnable: '1';
  pageNum: number;
  pageSize: number;
  sqlFilter: string;
}
```

- [ ] **Step 4: Implement the pure normalizer**

```ts
// src/core/hospital-area.ts
import type { HospAreaRawRecord, HospAreaRecord } from '../types/hospital-area.ts';

export function normalizeHospitalAreaRecords(records: HospAreaRawRecord[]): HospAreaRecord[] {
  const seen = new Set<number>();
  const result: HospAreaRecord[] = [];
  for (const raw of records) {
    const id = Number(raw.id ?? 0);
    const areaName = String(raw.areaName ?? '').trim();
    if (!Number.isFinite(id) || id <= 0 || !areaName || raw.isEnable === '0' || seen.has(id))
      continue;
    seen.add(id);
    result.push({
      id,
      areaName,
      areaCode: String(raw.areaCode ?? '').trim(),
      areaOutCode: String(raw.areaOutCode ?? '').trim(),
      isEnable: String(raw.isEnable ?? '1'),
    });
  }
  return result;
}
```

- [ ] **Step 5: Implement paginated fetching**

```ts
// src/api/hospital-area.ts
import { apiUrl, postJson } from '@/api/http-client';
import { normalizeHospitalAreaRecords } from '@/core/hospital-area';
import type {
  HospAreaPageData,
  HospAreaQueryParams,
  HospAreaRawRecord,
  HospAreaRecord,
} from '@/types/hospital-area';

const HOSPITAL_AREA_PATH = 'hosp/hospAreaInfo/queryHospAreaInfo';
const PAGE_SIZE = 200;

function queryBody(pageNum: number): HospAreaQueryParams {
  return { areaCode: '', areaName: '', isEnable: '1', pageNum, pageSize: PAGE_SIZE, sqlFilter: '' };
}

export async function fetchHospitalAreas(): Promise<HospAreaRecord[]> {
  const rawRecords: HospAreaRawRecord[] = [];
  let pageNum = 1;
  let pages = 1;
  do {
    const response = await postJson<HospAreaPageData>(apiUrl(HOSPITAL_AREA_PATH), queryBody(pageNum));
    if (response.code !== 200)
      throw new Error(response.message || '查询病区信息失败');
    rawRecords.push(...(response.data?.records ?? []));
    pages = Math.max(1, Number(response.data?.pages ?? 1));
    pageNum += 1;
  } while (pageNum <= pages);

  return normalizeHospitalAreaRecords(rawRecords);
}
```

- [ ] **Step 6: Implement the allow-all access seam and preferred area rule**

```ts
// src/core/area-access.ts
import type { HospAreaRecord } from '../types/hospital-area.ts';

export interface AreaAccessPolicy {
  filterAreas(areas: HospAreaRecord[]): HospAreaRecord[];
  canSwitchArea(currentAreaId: number, targetAreaId: number): boolean;
}

export const allowAllAreaAccessPolicy: AreaAccessPolicy = {
  filterAreas: areas => [...areas],
  canSwitchArea: () => true,
};

export function resolvePreferredAreaId(
  areas: HospAreaRecord[],
  storedId?: string | number | null,
  configuredId?: string | number | null,
): number | null {
  for (const candidate of [storedId, configuredId]) {
    const id = Number(candidate ?? 0);
    if (areas.some(area => area.id === id))
      return id;
  }
  return areas[0]?.id ?? null;
}
```

- [ ] **Step 7: Run the focused test and typecheck**

Run: `node --experimental-strip-types scripts/hospital-area.test.ts`

Expected: exit 0 with no assertion output.

Run: `npm run build`

Expected: `vue-tsc --noEmit` and `vite build` both succeed.

---

### Task 2: Explicit `areaId` Device Discovery

**Files:**
- Create: `scripts/swp-device-query.test.ts`
- Create: `src/core/swp-device-query.ts`
- Modify: `src/types/swp-device.ts`
- Modify: `src/api/swp-device.ts`
- Modify: `src/api/door-device.ts`

**Interfaces:**
- Consumes: selected numeric `areaId` from the store.
- Produces: `buildSwpDeviceQueryBody({ areaId }): SwpDeviceQueryParams` from the pure core module and `fetchDoorDeviceList({ areaId })` from the API layer.

- [ ] **Step 1: Write the failing device query test**

```ts
// scripts/swp-device-query.test.ts
import assert from 'node:assert/strict';
import { buildSwpDeviceQueryBody } from '../src/core/swp-device-query.ts';

assert.deepEqual(buildSwpDeviceQueryBody({ areaId: 192 }), {
  areaId: 192,
  deptId: '',
  deviceIp: '',
  deviceName: '',
  deviceTypeId: 4,
  online: '',
  pageNum: 1,
  pageSize: 100,
  sipNo: '',
});
assert.throws(() => buildSwpDeviceQueryBody({ areaId: 0 }), /有效病区/);
```

- [ ] **Step 2: Run the test and confirm the old query shape fails**

Run: `node --experimental-strip-types scripts/swp-device-query.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/swp-device-query.ts`.

- [ ] **Step 3: Replace the SWP query type with documented fields**

```ts
// src/types/swp-device.ts
export interface SwpDeviceQueryParams {
  areaId: number;
  deptId: number | string;
  deviceIp: string;
  deviceName: string;
  deviceTypeId: number;
  online: string;
  pageNum: number;
  pageSize: number;
  sipNo: string;
}
```

Keep `SwpDeviceRecord`. Extend `SwpDevicePageData` so it tolerates both `pageNum/pageSize` and response-side `current/size` metadata without using those fields in requests.

- [ ] **Step 4: Implement the pure body builder**

```ts
// src/core/swp-device-query.ts
import type { SwpDeviceQueryParams } from '../types/swp-device.ts';

export interface DiscoverDoorDevicesOptions {
  areaId: number;
  deviceTypeId?: number;
}

export function buildSwpDeviceQueryBody(
  options: DiscoverDoorDevicesOptions,
): SwpDeviceQueryParams {
  const areaId = Number(options.areaId);
  if (!Number.isFinite(areaId) || areaId <= 0)
    throw new Error('请选择有效病区后再查询设备');
  return {
    areaId,
    deptId: '',
    deviceIp: '',
    deviceName: '',
    deviceTypeId: options.deviceTypeId ?? 4,
    online: '',
    pageNum: 1,
    pageSize: DOOR_LIST_PAGE_SIZE,
    sipNo: '',
  };
}
```

- [ ] **Step 5: Correct the endpoint path and consume the pure builder**

In `src/api/swp-device.ts`, import `buildSwpDeviceQueryBody` and `DiscoverDoorDevicesOptions` from `@/core/swp-device-query`, set `DEVICE_LIST_PATH` to `swpDeviceInfo/querySwpDeviceInfo`, and use the builder in `fetchDoorDeviceListOnce(options)`. Keep the cache key based on `areaId` and `deviceTypeId`; clearing the cache must still remove both key and records.

- [ ] **Step 6: Thread the ward ID through the door-device API**

```ts
export interface FetchDoorDeviceListOptions {
  areaId?: number;
}

async function fetchRemoteDoorDeviceList(areaId: number): Promise<FetchDoorDevicesResult> {
  const records = await fetchDoorDeviceListOnce({ areaId });
  const discoveredDevices = sortDoorDevices(mapSwpRecordsToDoorDevices(records));
  if (!discoveredDevices.length)
    throw new Error('querySwpDeviceInfo 未返回任何可用门口机');

  lastResolvedDoorCodes = discoveredDevices.map(device => device.doorDeviceInfo.deviceCode);
  const settled = await Promise.allSettled(lastResolvedDoorCodes.map(code => fetchDoorDeviceInfo(code)));
  const detailDevices = settled
    .filter((item): item is PromiseFulfilledResult<DoorDeviceInfo> => item.status === 'fulfilled')
    .map(item => item.value);
  if (!detailDevices.length)
    throw new Error('queryBaseDeviceInfo 未返回任何可用门口机详情');

  const warnings = settled.flatMap((item, index) => item.status === 'fulfilled'
    ? []
    : [`${lastResolvedDoorCodes[index] ?? '未知设备'} 门口机详情加载失败`]);
  const enriched = await enrichDoorEnvData(sortDoorDevices(detailDevices));
  return {
    devices: enriched,
    codes: enriched.map(device => device.doorDeviceInfo.deviceCode),
    codeSource: 'discover',
    warnings,
  };
}

export async function fetchDoorDeviceList(
  options: FetchDoorDeviceListOptions = {},
): Promise<FetchDoorDevicesResult> {
  if (getDataSource() === 'remote') {
    const areaId = Number(options.areaId ?? 0);
    if (!Number.isFinite(areaId) || areaId <= 0)
      throw new Error('请选择病区后再加载病房数据');
    return fetchRemoteDoorDeviceList(areaId);
  }
  const response = await fetchMockDoorDeviceList();
  if (response.code !== 200)
    throw new Error(response.message || '获取门口机数据失败');
  return {
    devices: response.data,
    codes: response.data.map(device => device.doorDeviceInfo.deviceCode),
    codeSource: 'discover',
    warnings: [],
  };
}
```

Remove `VITE_AREA_ID` from remote load error copy because it is no longer the active query source.

- [ ] **Step 7: Run the focused test and build**

Run: `node --experimental-strip-types scripts/swp-device-query.test.ts`

Expected: exit 0.

Run: `npm run build`

Expected: build succeeds after every `fetchDoorDeviceList` caller supplies the new options shape.

---

### Task 3: Ward-Scoped Alerts and Async Request Guard

**Files:**
- Create: `src/core/area-request-guard.ts`
- Modify: `src/core/alert-workflow.ts`
- Modify: `scripts/alert-workflow.test.ts`
- Modify: `scripts/swp-device-query.test.ts`

**Interfaces:**
- Produces: `createAreaRequestGuard()` with `begin()` and `isCurrent(token)`.
- Produces: `collectAlertTasks(area, ackState, areaScope?)` whose IDs are scoped when `areaScope` is supplied.

- [ ] **Step 1: Extend the failing tests for request ordering and alert isolation**

```ts
// append to scripts/swp-device-query.test.ts
import { createAreaRequestGuard } from '../src/core/area-request-guard.ts';

const guard = createAreaRequestGuard();
const first = guard.begin();
const second = guard.begin();
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);
```

```ts
// append to scripts/alert-workflow.test.ts
const area192Tasks = collectAlertTasks(area, {}, '192');
const area193Tasks = collectAlertTasks(area, {}, '193');
assert.ok(area192Tasks.every(task => task.id.startsWith('area:192:')));
assert.equal(area192Tasks.some(task => area193Tasks.some(other => other.id === task.id)), false);
```

- [ ] **Step 2: Run both tests and verify the new contracts fail**

Run: `node --experimental-strip-types scripts/swp-device-query.test.ts`

Expected: FAIL with missing `area-request-guard.ts`.

Run: `node --experimental-strip-types scripts/alert-workflow.test.ts`

Expected: FAIL because `collectAlertTasks` does not accept or apply an area scope.

- [ ] **Step 3: Implement the monotonic request guard**

```ts
// src/core/area-request-guard.ts
export interface AreaRequestGuard {
  begin(): number;
  isCurrent(token: number): boolean;
}

export function createAreaRequestGuard(): AreaRequestGuard {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(token) {
      return token === current;
    },
  };
}
```

- [ ] **Step 4: Scope every generated alert ID**

Add a helper in `src/core/alert-workflow.ts`:

```ts
function scopedTaskId(id: string, areaScope?: string | number): string {
  return areaScope == null || String(areaScope).trim() === ''
    ? id
    : `area:${areaScope}:${id}`;
}
```

Pass `areaScope` through `collectAlertTasks` and `createBedTask`, and apply it to bed, environment, offline, and infusion task IDs. Keep the parameter optional so existing callers and tests remain compatible.

- [ ] **Step 5: Run both tests and build**

Run: `node --experimental-strip-types scripts/swp-device-query.test.ts && node --experimental-strip-types scripts/alert-workflow.test.ts`

Expected: both scripts exit 0.

Run: `npm run build`

Expected: build succeeds.

---

### Task 4: Transactional Area State in Pinia

**Files:**
- Modify: `src/stores/twin-store.ts`
- Modify: `src/services/remote-area-fetcher.ts`

**Interfaces:**
- Consumes: `fetchHospitalAreas`, `allowAllAreaAccessPolicy`, `resolvePreferredAreaId`, `createAreaRequestGuard`, and `fetchDoorDeviceList({ areaId })`.
- Produces: `loadAreaOptions()`, `enterArea(areaId)`, `switchArea(areaId)`, and `refreshCurrentArea()`.

- [ ] **Step 1: Add ward selection state and local-storage constants**

Add these refs beside the existing area state:

```ts
const AREA_STORAGE_KEY = 'ward-digital-twin:last-area-id';
const areaOptions = ref<HospAreaRecord[]>([]);
const selectedAreaId = ref<number | null>(null);
const pendingAreaId = ref<number | null>(null);
const preferredAreaId = ref<number | null>(null);
const isAreaListLoading = ref(false);
const isAreaSwitching = ref(false);
const areaListError = ref<string | null>(null);
const areaSwitchError = ref<string | null>(null);
const areaRequestGuard = createAreaRequestGuard();
```

Initialize the alert task computed value with the selected ward scope:

```ts
const alertTasks = computed(() => area.value
  ? collectAlertTasks(area.value, alertAckState.value, selectedAreaId.value ?? undefined)
  : []);
```

- [ ] **Step 2: Add `loadAreaOptions()`**

```ts
async function loadAreaOptions() {
  isAreaListLoading.value = true;
  areaListError.value = null;
  try {
    const areas = allowAllAreaAccessPolicy.filterAreas(await fetchHospitalAreas());
    areaOptions.value = areas;
    const storedId = typeof window === 'undefined' ? null : window.localStorage.getItem(AREA_STORAGE_KEY);
    preferredAreaId.value = resolvePreferredAreaId(areas, storedId, getAreaId());
    if (!areas.length)
      areaListError.value = '暂无可用病区';
  }
  catch (error) {
    areaOptions.value = [];
    preferredAreaId.value = null;
    areaListError.value = error instanceof Error ? error.message : '病区列表加载失败';
  }
  finally {
    isAreaListLoading.value = false;
  }
}
```

- [ ] **Step 3: Split fetching from committing**

Create an internal `AreaSnapshot` containing `area`, `deviceCodes`, `hospitalInfo`, and `warnings`. For remote mode, build it without mutating refs:

```ts
interface AreaSnapshot {
  area: TwinAreaEntity;
  deviceCodes: string[];
  hospitalInfo: HospitalInfo | null;
  warnings: string[];
}

async function fetchAreaSnapshot(areaId: number): Promise<AreaSnapshot> {
  const [result, hospital] = await Promise.all([
    fetchDoorDeviceList({ areaId }),
    fetchHospitalInfoSafe(),
  ]);
  if (!result.devices.length)
    throw new Error('未获取到任何病房数据');

  const nextArea = mapDoorListToTwinArea(result.devices);
  const selectedOption = areaOptions.value.find(item => item.id === areaId);
  if (selectedOption) {
    nextArea.areaName = selectedOption.areaName;
    nextArea.areaCode = selectedOption.areaCode;
  }
  await enrichAreaBedTemplateIds(nextArea);
  return {
    area: nextArea,
    deviceCodes: result.codes,
    hospitalInfo: hospital,
    warnings: [...result.warnings, ...validateDoorDeviceCodes(result.devices)],
  };
}
```

Keep the current database snapshot branch in `loadArea()` for compatibility, but `enterArea()` and `switchArea()` require `dataSource === 'remote'` and call `fetchAreaSnapshot(areaId)`. Task 6 changes development mode to `remote`, so the new picker never synthesizes options for mock or database data.

- [ ] **Step 4: Implement a single transactional loader**

```ts
async function commitRequestedArea(areaId: number, mode: 'enter' | 'switch'): Promise<boolean> {
  const requestToken = areaRequestGuard.begin();
  pendingAreaId.value = areaId;
  isAreaSwitching.value = true;
  areaSwitchError.value = null;
  try {
    const snapshot = await fetchAreaSnapshot(areaId);
    if (!areaRequestGuard.isCurrent(requestToken))
      return false;
    area.value = snapshot.area;
    deviceCodes.value = snapshot.deviceCodes;
    hospitalInfo.value = snapshot.hospitalInfo;
    dataWarnings.value = snapshot.warnings;
    selectedAreaId.value = areaId;
    statusHistory.value = [];
    sceneType.value = 'nurse-station';
    currentRoomIndex.value = -1;
    selectedBedCode.value = null;
    wardInteriorView.value = '3d';
    lastFetchedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    window.localStorage.setItem(AREA_STORAGE_KEY, String(areaId));
    return true;
  }
  catch (error) {
    if (areaRequestGuard.isCurrent(requestToken))
      areaSwitchError.value = error instanceof Error ? error.message : `${mode === 'enter' ? '进入' : '切换'}病区失败`;
    return false;
  }
  finally {
    if (areaRequestGuard.isCurrent(requestToken)) {
      pendingAreaId.value = null;
      isAreaSwitching.value = false;
    }
  }
}
```

- [ ] **Step 5: Implement enter, switch, and refresh orchestration**

```ts
async function enterArea(areaId: number) {
  const success = await commitRequestedArea(areaId, 'enter');
  if (success)
    startRemoteServices();
  return success;
}

async function switchArea(areaId: number) {
  if (selectedAreaId.value === areaId)
    return true;
  if (!allowAllAreaAccessPolicy.canSwitchArea(selectedAreaId.value ?? areaId, areaId))
    return false;
  stopRemoteServices();
  const success = await commitRequestedArea(areaId, 'switch');
  startRemoteServices();
  return success;
}

async function refreshCurrentArea(options: { silent?: boolean; preserveScene?: boolean } = {}) {
  const areaId = selectedAreaId.value;
  if (areaId == null)
    return false;
  const requestToken = areaRequestGuard.begin();
  const previousSceneType = sceneType.value;
  const previousRoomIndex = currentRoomIndex.value;
  const previousBedCode = selectedBedCode.value;
  const previousInteriorView = wardInteriorView.value;
  if (!options.silent)
    isLoading.value = true;
  try {
    const snapshot = await fetchAreaSnapshot(areaId);
    if (!areaRequestGuard.isCurrent(requestToken) || selectedAreaId.value !== areaId)
      return false;
    area.value = snapshot.area;
    deviceCodes.value = snapshot.deviceCodes;
    hospitalInfo.value = snapshot.hospitalInfo;
    dataWarnings.value = snapshot.warnings;
    if (options.preserveScene) {
      sceneType.value = previousSceneType;
      currentRoomIndex.value = previousRoomIndex >= 0 && previousRoomIndex < snapshot.area.rooms.length
        ? previousRoomIndex
        : -1;
      selectedBedCode.value = previousBedCode;
      wardInteriorView.value = previousInteriorView;
    }
    lastFetchedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    return true;
  }
  catch (error) {
    if (!options.silent && areaRequestGuard.isCurrent(requestToken))
      error.value = error instanceof Error ? error.message : '刷新病区失败';
    return false;
  }
  finally {
    if (!options.silent && areaRequestGuard.isCurrent(requestToken))
      isLoading.value = false;
  }
}
```

A silent failure keeps the current area and does not set the full-page error. Manual `reset()` clears the discovery cache and calls `refreshCurrentArea()` rather than re-entering a ward.

- [ ] **Step 6: Scope the polling service**

Replace `store.loadArea({ preserveScene: true, silent: true })` in `remote-area-fetcher.ts` with:

```ts
await store.refreshCurrentArea({ preserveScene: true, silent: true });
```

The store checks `selectedAreaId` before committing, so a response for the previous ward is discarded after a switch.

- [ ] **Step 7: Export all new state and actions and run the build**

Export all eight selection refs (`areaOptions`, `selectedAreaId`, `pendingAreaId`, `preferredAreaId`, `isAreaListLoading`, `isAreaSwitching`, `areaListError`, `areaSwitchError`) and four actions from the Pinia return object. Keep `loadArea` only for the current database compatibility path; remote refreshes must call `refreshCurrentArea()` and never read `VITE_AREA_ID` for active loads.

Run: `npm run build`

Expected: typecheck catches no missing store properties or device API callers.

---

### Task 5: Area Selection Page and Switch Drawer

**Files:**
- Create: `src/components/AreaSelectionView.vue`
- Create: `src/components/AreaSwitcher.vue`
- Modify: `src/components/dashboard/DashboardHeader.vue`

**Interfaces:**
- `AreaSelectionView` consumes areas, preferred ID, loading, and error; emits `enter(areaId)` and `retry()`.
- `AreaSwitcher` consumes areas, current ID, pending ID, switching, and error; emits `switch(areaId)` and `close()`.
- `DashboardHeader` emits `open-area-switch` from the current ward button.

- [ ] **Step 1: Implement `AreaSelectionView.vue` behavior**

Use these exact props and emits:

```ts
const props = defineProps<{
  areas: HospAreaRecord[];
  preferredAreaId: number | null;
  isListLoading: boolean;
  isEntering: boolean;
  pendingAreaId: number | null;
  error: string | null;
}>();

const emit = defineEmits<{
  enter: [areaId: number];
  retry: [];
}>();
```

Maintain local `query` and `chosenAreaId`. Synchronize the initial choice from `preferredAreaId`; filter case-insensitively by `areaName`, `areaCode`, and `areaOutCode`. Render:

- Platform header and live-service status.
- “选择工作病区” heading.
- Search input.
- Responsive repeated ward tiles with “上次进入” on `preferredAreaId`.
- Stable full-width enter button labeled `进入{areaName}护士站`.
- Empty, loading, and retry states within the same layout.

Use the established dark dashboard palette, 6px card radii, visible keyboard focus, `aria-pressed` for ward tiles, and no decorative image/SVG dependency.

- [ ] **Step 2: Implement `AreaSwitcher.vue` behavior**

Use these exact props and emits:

```ts
const props = defineProps<{
  open: boolean;
  areas: HospAreaRecord[];
  currentAreaId: number;
  pendingAreaId: number | null;
  switching: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  close: [];
  switch: [areaId: number];
}>();
```

Keep a local candidate ID. Clicking a list row selects it but does not switch; the drawer footer button confirms. Disable confirmation for the current ward or while switching. Close on overlay click and `Escape` only when not switching. Render loading copy as `正在切换至{areaName}` while the old scene remains visible behind the mask.

- [ ] **Step 3: Convert the dashboard ward label into a switch trigger**

Add `canSwitchArea?: boolean` and `isAreaSwitching?: boolean` props to `DashboardHeader.vue`, and add:

```ts
const emit = defineEmits<{
  refresh: [];
  openAreaSwitch: [];
}>();
```

Render `areaName` in a button with a downward chevron and use `deptName` as secondary copy. The button remains visible on narrow viewports; the existing center product title must resize/wrap without overlapping it. Disable both switch and refresh controls while switching.

- [ ] **Step 4: Run the build**

Run: `npm run build`

Expected: Vue template and SCSS compilation succeed, with no unused props or emits.

---

### Task 6: Boot Orchestration, Integration, and Real-Interface Verification

**Files:**
- Modify: `src/App.vue`
- Modify: `.env.development`

**Interfaces:**
- Consumes all store selection state/actions and both new UI components.
- Produces the final boot → select → enter → switch workflow.

- [ ] **Step 1: Switch development verification to the real source**

Change only:

```dotenv
VITE_DATA_SOURCE=remote
```

Do not edit, print, or copy the existing token value.

- [ ] **Step 2: Change the startup pipeline**

Replace the startup `store.loadArea()` and early service startup with:

```ts
setBootProgress(58, '同步可用病区');
await store.loadAreaOptions();
setBootProgress(86, '准备病区工作台');
finishBootProgress();
```

A hospital-area request failure must not bypass the selection screen. `finishBootProgress()` still completes, and `AreaSelectionView` displays `areaListError` with retry.

- [ ] **Step 3: Route page states in the root template**

After the startup loader, insert this selection branch immediately before the existing `div.digital-twin__main`, and change the main branch from `v-else-if="area"` to `v-else`:

```vue
<AreaSelectionView
  v-if="!area"
  :areas="areaOptions"
  :preferred-area-id="preferredAreaId"
  :is-list-loading="isAreaListLoading"
  :is-entering="isAreaSwitching"
  :pending-area-id="pendingAreaId"
  :error="areaSwitchError || areaListError"
  @enter="store.enterArea"
  @retry="store.loadAreaOptions"
/>
```

Remove the old full-page `isLoading`/`error` branch that hides an already loaded ward during refresh or failed switch.

- [ ] **Step 4: Wire the switch drawer**

Add `const isAreaSwitcherOpen = ref(false)`. Pass switch props to `DashboardHeader`, open the drawer from `@open-area-switch`, and render:

```vue
<AreaSwitcher
  v-if="area && selectedAreaId != null"
  :open="isAreaSwitcherOpen"
  :areas="areaOptions"
  :current-area-id="selectedAreaId"
  :pending-area-id="pendingAreaId"
  :switching="isAreaSwitching"
  :error="areaSwitchError"
  @close="isAreaSwitcherOpen = false"
  @switch="handleAreaSwitch"
/>
```

`handleAreaSwitch(areaId)` awaits `store.switchArea(areaId)` and closes the drawer only on success. The successful store transaction always returns to the nurse-station scene.

- [ ] **Step 5: Run all focused checks**

Run:

```bash
node --experimental-strip-types scripts/hospital-area.test.ts
node --experimental-strip-types scripts/swp-device-query.test.ts
node --experimental-strip-types scripts/alert-workflow.test.ts
npm run build
```

Expected: all assertion scripts exit 0 and Vite emits `dist` successfully.

- [ ] **Step 6: Start the development server and verify the real API**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL. In the browser network log, verify:

- `/swp/hosp/hospAreaInfo/queryHospAreaInfo` returns enabled ward records.
- Initial display does not call `querySwpDeviceInfo` until “进入” is confirmed.
- `querySwpDeviceInfo` bodies contain the selected `areaId`, `deviceTypeId: 4`, `pageNum: 1`, and `pageSize: 100`.
- Switching another ward issues a new device request with the new ID.

- [ ] **Step 7: Perform desktop and mobile visual verification**

Check at 1440×900 and 390×844:

- Startup fades into the selection page without a blank frame.
- Long ward names wrap or truncate without overflowing tiles or buttons.
- Search, selected state, enter loading, empty, and error/retry states do not shift the layout.
- The dashboard header always exposes the current ward without overlapping the title.
- The drawer stays within the viewport, is scrollable, and does not overlap its confirmation footer.
- The old scene stays visible during switching and remains usable after a failed switch.

- [ ] **Step 8: Inspect the final diff without reverting unrelated files**

Because this workspace has no Git metadata, use targeted file reads and `rg` to confirm:

```bash
rg -n "queryHospAreaInfo|querySwpDeviceInfo|selectedAreaId|switchArea|area:s" src scripts
rg -n "current:|size:" src/api/swp-device.ts src/types/swp-device.ts
```

Expected: both endpoints use non-duplicated paths, active loads explicitly carry `selectedAreaId`, alert IDs include an area scope, and no request still sends `current/size`.
