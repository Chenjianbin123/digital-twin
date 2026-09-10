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

test('first entry mounts only station, visited scenes reuse their entries', async () => {
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

test('late ready from previous scene cannot dismiss current loading feedback', async () => {
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
    assert.equal(s.feedback.value, null);
  } finally { s.effect.stop(); }
});

test('area changes and logout discard entries and reject old callbacks', async () => {
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
    s.scope.value = null;
    await nextTick();
    assert.equal(s.feedback.value, null);
    assert.ok(Object.values(s.scenes.value).every(entry => !entry.requested));
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
