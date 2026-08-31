import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const header = readFileSync(new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url), 'utf8');
const bottomNav = readFileSync(new URL('../src/components/dashboard/DashboardBottomNav.vue', import.meta.url), 'utf8');
const areaSelection = readFileSync(new URL('../src/components/AreaSelectionView.vue', import.meta.url), 'utf8');
const nursePanel = readFileSync(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8');
const areaNav = readFileSync(new URL('../src/components/dashboard/DashboardAreaNav.vue', import.meta.url), 'utf8');

test('main workspace scales panel widths and reserves safe viewport space', () => {
  assert.match(app, /--scene-panel-width:\s*clamp\(/);
  assert.match(app, /--mobile-panel-height:/);
  assert.match(app, /min-height:\s*100svh/);
  assert.match(app, /env\(safe-area-inset-bottom\)/);
});

test('dashboard header compresses before changing to the compact two-row layout', () => {
  assert.match(header, /@media \(min-width: 1024px\) and \(max-width: 1199px\)/);
  assert.match(header, /font-size:\s*clamp\(17px,\s*1\.8vw,\s*20px\)/);
  assert.match(header, /max-width:\s*min\(220px,\s*24vw\)/);
});

test('bottom navigation stays above the panel on compact desktop and mobile viewports', () => {
  assert.match(bottomNav, /@media \(min-width: 769px\) and \(max-width: 1023px\)/);
  assert.match(bottomNav, /bottom:\s*calc\(var\(--mobile-panel-height\)/);
  assert.match(bottomNav, /env\(safe-area-inset-bottom\)/);
  assert.match(app, /&__main--panels-hidden :deep\(\.dash-bottom\)[\s\S]*?bottom: calc\(10px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(app, /&__main--panels-hidden &__panel-toggle[\s\S]*?bottom: calc\(14px \+ env\(safe-area-inset-bottom\)\);/);
});

test('area selection adapts to short screens without forcing a fixed-height card', () => {
  assert.match(areaSelection, /@media \(max-height: 720px\)/);
  assert.match(areaSelection, /width:\s*min\(760px,\s*calc\(100% - clamp\(/);
  assert.match(areaSelection, /min-height:\s*100svh/);
});

test('nurse station cards reflow before the panel becomes a bottom sheet', () => {
  assert.match(nursePanel, /@media \(min-width: 1024px\) and \(max-width: 1199px\)/);
  assert.match(nursePanel, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(nursePanel, /@media \(max-height: 720px\) and \(min-width: 1024px\)/);
});

test('ward navigation reserves space for the responsive side panel', () => {
  assert.match(areaNav, /@media \(min-width: 1280px\) and \(max-width: 1599px\)/);
  assert.match(areaNav, /calc\(100vw - var\(--scene-panel-width/);
});
