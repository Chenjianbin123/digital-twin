import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, ref } from 'vue';
import { useSceneLoading } from './use-scene-loading.ts';
import type { TwinSceneType } from '../types/twin';

function setup() {
  const effect = effectScope();
  const scope = ref<string | null>('area:1');
  const target = ref<TwinSceneType | null>('nurse-station');
  const loading = effect.run(() => useSceneLoading(scope, target))!;
  return { effect, scope, target, ...loading };
}

test('first entry mounts only station, cached switches show feedback without recreating entries', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    assert.equal(s.scenes.value['nurse-station'].requested, true);
    assert.equal(s.scenes.value.ward.requested, false);
    assert.equal(s.scenes.value['ward-interior'].requested, false);
    s.scenes.value['nurse-station'].onState('ready');
    assert.equal(Boolean(s.feedback.value), false);
    s.target.value = 'ward';
    await nextTick();
    const corridor = s.scenes.value.ward;
    assert.equal(corridor.requested, true);
    assert.equal(s.feedback.value?.status, 'loading');
    corridor.onState('ready');
    s.target.value = 'nurse-station';
    await nextTick();
    s.target.value = 'ward';
    await nextTick();
    assert.equal(s.scenes.value.ward, corridor);
    assert.equal(s.feedback.value?.phase, 'switching');
    assert.equal(s.feedback.value?.status, 'loading');
    t.mock.timers.tick(819);
    assert.ok(s.feedback.value);
    t.mock.timers.tick(1);
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('direct room links load interior without mounting corridor; 2.5D does not request 3D', async () => {
  const s = setup();
  try {
    s.target.value = null;
    await nextTick();
    assert.equal(s.scenes.value['ward-interior'].requested, false);
    s.target.value = 'ward-interior';
    await nextTick();
    assert.equal(s.scenes.value['ward-interior'].requested, true);
    assert.equal(s.scenes.value.ward.requested, false);
  } finally { s.effect.stop(); }
});

test('late ready from previous scene cannot dismiss current loading feedback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    s.target.value = 'ward';
    await nextTick();
    s.target.value = 'ward-interior';
    await nextTick();
    s.scenes.value.ward.onState('ready');
    assert.equal(s.feedback.value?.tone, 'interior');
    assert.equal(s.feedback.value?.status, 'loading');
    s.scenes.value['ward-interior'].onState('ready');
    assert.equal(s.feedback.value?.phase, 'switching');
    t.mock.timers.tick(720);
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('area changes and logout discard entries and reject old callbacks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    s.target.value = 'ward';
    await nextTick();
    const old = s.scenes.value.ward;
    s.scope.value = 'area:2';
    s.target.value = 'nurse-station';
    await nextTick();
    old.onState('ready');
    assert.equal(s.scenes.value.ward.requested, false);
    assert.notEqual(s.scenes.value.ward.key, old.key);
    assert.equal(s.scenes.value['nurse-station'].state, 'loading');
    s.scenes.value['nurse-station'].onState('ready');
    assert.equal(s.feedback.value, null);
    t.mock.timers.tick(1000);
    assert.equal(s.feedback.value, null);
    s.scope.value = null;
    await nextTick();
    assert.equal(s.feedback.value, null);
    assert.ok(Object.values(s.scenes.value).every(entry => !entry.requested));
  } finally { s.effect.stop(); }
});

test('slow model loading and failures outlive the visual transition', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    s.target.value = 'ward';
    await nextTick();
    t.mock.timers.tick(2000);
    assert.equal(s.feedback.value?.phase, 'loading');
    assert.equal(s.feedback.value?.status, 'loading');
    s.scenes.value.ward.onState('fallback');
    t.mock.timers.tick(2000);
    assert.equal(s.feedback.value?.status, 'fallback');
    s.retry();
    assert.equal(s.feedback.value?.status, 'loading');
    s.scenes.value.ward.onState('ready');
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('rapid switches restart the transition and same-scene selection does not restart it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    for (const entry of Object.values(s.scenes.value)) entry.onState('ready');
    s.target.value = 'ward';
    await nextTick();
    t.mock.timers.tick(500);
    s.target.value = 'ward-interior';
    await nextTick();
    t.mock.timers.tick(320);
    assert.equal(s.feedback.value?.tone, 'interior');
    s.target.value = 'ward-interior';
    await nextTick();
    t.mock.timers.tick(400);
    assert.equal(Boolean(s.feedback.value), false);
    s.target.value = 'nurse-station';
    await nextTick();
    assert.equal(s.feedback.value?.phase, 'switching');
    t.mock.timers.tick(760);
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('2.5D target and disposal cancel pending switch feedback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    s.scenes.value.ward.onState('ready');
    s.target.value = 'ward';
    await nextTick();
    assert.ok(s.feedback.value);
    s.target.value = null;
    await nextTick();
    assert.equal(s.feedback.value, null);
    t.mock.timers.tick(1000);
    s.target.value = 'ward';
    await nextTick();
    assert.equal(s.feedback.value, null);
    s.scenes.value['nurse-station'].onState('ready');
    s.target.value = 'nurse-station';
    await nextTick();
    assert.ok(s.feedback.value);
    s.effect.stop();
    assert.equal(s.feedback.value, null);
    t.mock.timers.tick(1000);
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('failure stays visible until retry; old attempt cannot complete new attempt', () => {
  const s = setup();
  try {
    const old = s.scenes.value['nurse-station'];
    old.onState('fallback');
    assert.equal(s.feedback.value?.status, 'fallback');
    s.retry();
    assert.notEqual(s.scenes.value['nurse-station'].key, old.key);
    old.onState('ready');
    assert.equal(s.feedback.value?.status, 'loading');
    s.scenes.value['nurse-station'].onState('ready');
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});


test('component download failure requires reload while model failure remains retryable', () => {
  const s = setup();
  try {
    const original = s.scenes.value['nurse-station'];
    original.onState('component-error');
    assert.equal(s.feedback.value?.status, 'fallback');
    assert.equal(s.feedback.value?.recovery, 'reload');
    s.retry();
    assert.equal(s.scenes.value['nurse-station'], original);
    original.onState('fallback');
    assert.equal(s.feedback.value?.recovery, 'retry');
    s.retry();
    assert.notEqual(s.scenes.value['nurse-station'], original);
    original.onState('component-error');
    assert.equal(s.feedback.value?.status, 'loading');
    assert.equal(s.feedback.value?.recovery, 'retry');
  } finally { s.effect.stop(); }
});
