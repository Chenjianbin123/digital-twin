import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, visual, panel, header, areaComponent, areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationVisualScene.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(visual, /@room-click="emit\('roomClick', \$event\)"/);
assert.doesNotMatch(visual, /class="nurse-station-visual__corridor"/);
assert.doesNotMatch(panel, /class="nurse-panel__cta"/);
assert.match(panel, /<button[\s\S]*?class="focus-room"/);
assert.match(panel, /进入走廊并定位/);
assert.match(panel, /<details class="nurse-panel__details"/);
assert.match(panel, /当前运行状态/);
assert.match(panel, /:max-items="4"/);
assert.doesNotMatch(panel, /运行指数/);
assert.match(app, /@model-state="stationModelState = \$event"/);
assert.match(app, /<DashboardHeader[\s\S]*?@logout="handleLogout"/);
assert.doesNotMatch(app.match(/<DashboardHeader[\s\S]*?\/>/)?.[0] ?? '', /:compact="isNurseStation"/);
assert.match(app, /&__main--station:not\(&__main--panels-hidden\) :deep\(\.dash-bottom\)/);
assert.match(app, /transform: translateX\(-50%\) scale\(0\.9\);/);
assert.match(app, /&__main--station &__panel-toggle:not\(&__panel-toggle--hidden\)/);
assert.match(app, /bottom: calc\(var\(--mobile-panel-height\) \+ 100px \+ env\(safe-area-inset-bottom\)\);/);
assert.match(visual, /modelState: AreaModelState/);
assert.match(areaComponent, /modelState: \[state: AreaModelState\]/);
assert.match(areaScene, /onModelState\?: \(state: AreaModelState\) => void/);
assert.match(areaScene, /this\.onModelState\?\.\('fallback'\)/);
assert.match(sceneConfig, /1-1\.glb\?v=20260901-h-n2-v1/);
assert.match(sceneConfig, /deskFov: \d+(?:\.\d+)?/);
assert.match(sceneConfig, /target: \{ x: -?\d+(?:\.\d+)?, y: -?\d+(?:\.\d+)?, z: -?\d+(?:\.\d+)? \}/);
assert.match(sceneConfig, /initialDistance: \d+(?:\.\d+)?/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -?\d+(?:\.\d+)?, elevationDeg: -?\d+(?:\.\d+)? \}/);
assert.match(areaScene, /private setupNurseStationAtmosphereLights\(\)/);
assert.match(areaScene, /new THREE\.RectAreaLight\(0xb8f3ff, 0\.78, 5\.8, 1\.2\)/);
assert.match(areaScene, /const overlayOpacity = 1;/);
assert.match(areaScene, /const envMapIntensity = options\?\.envMapIntensity \?\? 0\.56;/);
assert.match(areaScene, /material\.envMapIntensity = envMapIntensity;/);
assert.doesNotMatch(visual, /--station-base-x:\s*-32px/);
assert.doesNotMatch(visual, /handlePointerMove/);
assert.match(visual, /radial-gradient\(ellipse at 50% 56%/);
assert.match(visual, /nurse-station-visual__ambient/);
assert.match(visual, /nurse-station-visual__depth/);
assert.match(visual, /animation: station-scene-enter/);
assert.match(header, /class="dash-header__area-cluster"/);
assert.match(header, /class="dash-header__area-meta"/);
assert.match(header, /v-if="operatorRole && !compact"/);
assert.match(header, /:has\(\.dash-header__side--compact\)/);
assert.doesNotMatch(header, /{{ dataSource === 'remote' \? '实时数据'/);
assert.match(header, /dash-header__action-label">刷新/);
assert.match(header, /dash-header__action-label">退出/);
assert.match(header, /class="dash-header__actions"/);
assert.match(header, /class="dash-header__operator-dot"/);
assert.match(header, /class="dash-header__chevron"/);
assert.match(header, /&__chevron \{[\s\S]*?border-top: 5px solid #5bd3ef;/);
assert.match(header, /\.dash-header__actions \{[\s\S]*?margin-left: auto;/);
assert.match(header, /\.dash-header__area-cluster \{[\s\S]*?display: inline-flex;/);
assert.match(header, /\.dash-header__dept \{[\s\S]*?font-size: 13px;/);
assert.match(header, /\.dash-header__tag \{[\s\S]*?font-size: 13px;/);
assert.doesNotMatch(visual, /class="nurse-station-visual__caption"/);
assert.doesNotMatch(visual, /class="nurse-station-visual__caption-mark"/);
assert.doesNotMatch(visual, /area\.areaName/);
assert.doesNotMatch(visual, /area\.deptName/);
assert.doesNotMatch(visual, /NURSE STATION/);
assert.match(app, /&__main--station &__panel-toggle:not\(&__panel-toggle--hidden\) \{[\s\S]*?bottom: 15px;/);

console.log('Nurse-station complete optimization boundary checks passed.');
