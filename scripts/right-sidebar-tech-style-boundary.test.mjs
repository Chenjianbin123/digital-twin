import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
const panelStart = app.indexOf('  &__panel {');
const panelEnd = app.indexOf('  &__panel-body {', panelStart);
const panelStyle = app.slice(panelStart, panelEnd);

test('all scene sidebars use a translucent animated glass shell', () => {
  assert.match(app, /&__panel\s*\{/);
  assert.match(app, /backdrop-filter:\s*blur\(/);
  assert.match(app, /digital-panel-enter/);
  assert.match(app, /digital-panel-scan/);
  assert.match(app, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(app, /pointer-events:\s*none/);
});

test('sidebar motion layers stay visible above translucent content without blocking it', () => {
  assert.match(panelStyle, /&::after\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?pointer-events:\s*none;[\s\S]*?animation:\s*digital-panel-scan[^;]*infinite/);
  assert.match(panelStyle, /digital-panel-edge-pulse/);
  assert.match(panelStyle, /&::before\s*\{[\s\S]*?animation:\s*digital-panel-edge-pulse[^;]*infinite/);
});

test('sidebar tech motion has a clearly visible scan and ambient glow', () => {
  assert.match(app, /@keyframes digital-panel-grid-drift/);
  assert.match(panelStyle, /animation:[\s\S]*digital-panel-grid-drift[^;]*infinite/);
  assert.match(panelStyle, /rgba\(83,\s*222,\s*255,\s*0\.56\)/);
  assert.match(panelStyle, /digital-panel-scan\s+5\.4s/);
  assert.match(app, /0 0 26px rgba\(64, 214, 255, 0\.58\)/);
});
