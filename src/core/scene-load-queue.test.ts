import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireSceneLoad } from './scene-load-queue.ts';

test('preloaded scenes acquire a single load slot in request order', async () => {
  const first = await acquireSceneLoad();
  const order: number[] = [];
  const second = acquireSceneLoad().then(release => { order.push(2); return release; });
  const third = acquireSceneLoad().then(release => { order.push(3); return release; });
  await Promise.resolve();
  assert.deepEqual(order, []);
  first();
  const releaseSecond = await second;
  assert.deepEqual(order, [2]);
  releaseSecond();
  const releaseThird = await third;
  assert.deepEqual(order, [2, 3]);
  releaseThird();
});

test('failure and repeated release do not block or prematurely release later scenes', async () => {
  const release = await acquireSceneLoad();
  const next = acquireSceneLoad();
  try { throw new Error('decode failed'); }
  catch { /* Model loaders report failures at their scene boundary. */ }
  finally { release(); }
  const releaseNext = await next;
  let started = false;
  const last = acquireSceneLoad().then(done => { started = true; done(); });
  release();
  await Promise.resolve();
  assert.equal(started, false);
  releaseNext();
  await last;
  assert.equal(started, true);
});
