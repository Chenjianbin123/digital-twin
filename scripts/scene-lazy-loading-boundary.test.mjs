import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('src/App.vue');

test('scene components mount on first visit and use session-owned event callbacks', () => {
  for (const [component, entry] of [
    ['NurseStationVisualScene', "scenes['nurse-station']"],
    ['AreaScene3D', 'scenes.ward'],
    ['WardScene3D', "scenes['ward-interior']"],
  ]) {
    const tag = app.match(new RegExp('<' + component + '\\s[\\s\\S]*?/>'))?.[0] ?? '';
    assert.ok(tag.includes(entry + '.requested'), component + ' must not preload');
    assert.ok(tag.includes(':key="' + entry + '.key"'), component + ' must reset on scope/retry');
    assert.ok(tag.includes('@model-state="' + entry + '.onState"'), component + ' must forward readiness');
  }
  assert.doesNotMatch(app, /sceneSwitchTimer/);
});

test('all GLB readiness notifications follow GPU preparation and first render', () => {
  for (const [file, method, event] of [
    ['src/core/area-scene.ts', 'loadNurseStationModel', 'onModelState'],
    ['src/core/area-scene.ts', 'loadWardCorridorModel', 'onCorridorState'],
    ['src/core/ward-scene.ts', 'loadWardInteriorModel', 'onModelState'],
  ]) {
    const source = read(file);
    const start = source.indexOf('private async ' + method + '(');
    const end = source.indexOf('private ', start + 1);
    const body = source.slice(start, end);
    assert.ok(body.includes('await this.warmGpu()'), method + ': warmup must be awaited');
    const warmup = body.indexOf('await this.warmGpu()');
    const render = body.indexOf('this.renderer.render(', warmup);
    const ready = body.indexOf("this." + event + "?.('ready')", render);
    assert.ok(render > warmup && ready > render, method + ': ready must follow first render');
  }
});

test('loading feedback offers accessible recovery without disabling scene navigation', () => {
  const loader = read('src/components/SceneSwitchLoader.vue');
  assert.ok(loader.includes("$emit('retry')"));
  assert.ok(loader.includes("$emit('returnStation')"));
  assert.ok(loader.includes(':aria-busy="feedback.status'));
  assert.doesNotMatch(app, /&--scene-switching\s*\{\s*:deep\(\.dash-bottom\)/);
});
