import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-dom';
import { effectScope, ref } from 'vue';
import { useWorkspaceBootstrap } from '../src/core/use-workspace-bootstrap.ts';
import { useSceneLoading } from '../src/core/use-scene-loading.ts';

function setup(t, load = async () => null, hasArea = true) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });
  const scope = effectScope();
  const area = ref(hasArea);
  const boot = scope.run(() => useWorkspaceBootstrap(load, { waitForScene: () => area.value }));
  t.after(() => scope.stop());
  return { boot, scope, area };
}

test('data completion keeps one startup loader until the actual first scene is ready', async t => {
  const { boot, scope } = setup(t);
  const scenes = scope.run(() => useSceneLoading(ref('synthetic-area'), ref('nurse-station')));
  await boot.start();
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, true);
  assert.equal(boot.busy.value, true);
  assert.equal(boot.waitingForScene.value, true);
  assert.ok(boot.progress.value < 100);
  assert.match(boot.phase.value, /护士站.*首帧/);
  assert.equal(scenes.feedback.value?.status, 'loading');
  scenes.scenes.value['nurse-station'].onState('ready');
  boot.scene.value.onState(scenes.scenes.value['nurse-station'].state);
  assert.equal(boot.progress.value, 100);
  t.mock.timers.tick(80);
  assert.equal(boot.visible.value, false);
  assert.equal(scenes.feedback.value, null, 'no second loader after startup disappears');
});

test('a fast first frame is retained until data finishes', async t => {
  let resolve;
  const { boot } = setup(t, () => new Promise(done => { resolve = done; }));
  const task = boot.start();
  boot.scene.value.onState('ready');
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, true);
  assert.ok(boot.progress.value < 100);
  resolve(null); await task;
  assert.equal(boot.progress.value, 100);
  t.mock.timers.tick(80);
  assert.equal(boot.visible.value, false);
});

test('no remembered area exits to selection instead of waiting for a nonexistent model', async t => {
  const { boot } = setup(t, async () => null, false);
  await boot.start();
  t.mock.timers.tick(180);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.waitingForScene.value, false);
  assert.equal(boot.sceneError.value, null);
});

test('data failure exits to data recovery instead of masking it with a scene loader', async t => {
  const { boot } = setup(t, async () => { throw new Error('synthetic data error'); });
  await boot.start();
  t.mock.timers.tick(180);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.error.value, 'synthetic data error');
  assert.equal(boot.waitingForScene.value, false);
});

test('model failure retries only the scene and rejects old attempt callbacks', async t => {
  let loads = 0;
  const { boot } = setup(t, async () => { loads++; return null; });
  await boot.start();
  const old = boot.scene.value;
  old.onState('fallback');
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, true);
  assert.match(boot.sceneError.value, /模型加载失败/);
  boot.retryScene();
  const current = boot.scene.value;
  assert.notEqual(current.key, old.key);
  assert.equal(boot.sceneError.value, null);
  boot.retryScene();
  assert.equal(boot.scene.value.key, current.key, 'double retry does not replace a pending attempt');
  old.onState('ready');
  assert.ok(boot.progress.value < 100);
  current.onState('ready');
  t.mock.timers.tick(80);
  assert.equal(boot.visible.value, false);
  assert.equal(loads, 1);
});

test('component code failure requires reload, including failure before data resolves', async t => {
  let resolve;
  const { boot } = setup(t, () => new Promise(done => { resolve = done; }));
  const task = boot.start();
  boot.scene.value.onState('component-error');
  resolve(null); await task;
  assert.match(boot.sceneError.value, /刷新页面/);
  const key = boot.scene.value.key;
  boot.retryScene();
  assert.equal(boot.scene.value.key, key);
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, true);
});

test('logout and new login isolate model callbacks and cancel the old completion timer', async t => {
  const { boot } = setup(t);
  await boot.start();
  const old = boot.scene.value;
  old.onState('ready');
  boot.cancel();
  await boot.start();
  old.onState('ready');
  old.onState('component-error');
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, true);
  assert.equal(boot.sceneError.value, null);
  assert.equal(boot.scene.value.state, 'loading');
  boot.scene.value.onState('ready');
  t.mock.timers.tick(80);
  assert.equal(boot.visible.value, false);
});

test('disposal during model loading leaves no active loader or accepted late callback', async t => {
  const { boot, scope } = setup(t);
  await boot.start();
  const old = boot.scene.value;
  scope.stop();
  old.onState('fallback');
  t.mock.timers.tick(5000);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.busy.value, false);
  assert.equal(boot.sceneError.value, null);
  assert.equal(boot.progress.value, 0);
});

test('root and scene host wire the first-frame gate without hiding recovery or later switches', () => {
  const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
  const app = read('src/App.vue');
  const workspace = read('src/components/workspace/DigitalTwinWorkspace.vue');
  const loader = read('src/components/StartupLoader.vue');
  const station = read('src/components/NurseStationVisualScene.vue');
  assert.match(app, /waitForScene: \(\) => !!area.value/);
  const { descriptor } = parse(app);
  const { code } = compile(descriptor.template.content, { mode: 'module' });
  assert.match(code, /onModelState: _ctx.showStartupLoader \? _ctx.startupScene.onState : undefined/,
    'the actual App template must compile to the listener name consumed by the async wrapper');
  assert.match(app, /:startup-retry-key="startupScene.key"/);
  assert.match(workspace, /:feedback="startupLoading \? null : sceneSwitchFeedback"/);
  assert.match(workspace, /:inert="startupLoading"/);
  assert.match(workspace, /if \(startupLoading\) retryScene\(\)/);
  assert.match(loader, /\$emit\('retry'\)/);
  assert.match(loader, /\$emit\('cancel'\)/);
  assert.match(loader, /window.location.reload\(\)/);
  assert.match(station, /const AreaScene3D = defineRecoverableComponent/);
});
