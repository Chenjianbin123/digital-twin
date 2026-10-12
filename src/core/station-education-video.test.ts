import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bindStationEducationVideo } from './station-education-video.ts';

function fixture(t: test.TestContext) {
  const labels: string[] = [];
  let videoCreated = 0, plays = 0, pauses = 0, unloads = 0;
  class Video extends EventTarget {
    src = ''; preload = ''; crossOrigin = ''; muted = false; loop = false; playsInline = false;
    playResult: Promise<void> = Promise.resolve();
    play() { plays++; return this.playResult; }
    pause() { pauses++; }
    removeAttribute(name: string) { if (name === 'src') this.src = ''; }
    load() { unloads++; }
  }
  const video = new Video();
  const context = { fillRect() {}, strokeRect() {}, fillText(text: string) { labels.push(text); } };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: (tag: string) => {
    if (tag === 'video') { videoCreated++; return video; } return canvas;
  } } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const model = new THREE.Group(), source = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  source.name = 'Screen_Video'; model.add(source);
  return { model, source, video, labels, get stats() { return { videoCreated, plays, pauses, unloads }; } };
}

test('unconfigured TV shows no-video state and never creates a media request', t => {
  const f = fixture(t), tv = bindStationEducationVideo(f.model);
  tv.setActive(true); tv.setTheme(true);
  assert.equal(f.stats.videoCreated, 0);
  assert.ok(f.labels.includes('暂无视频'));
  assert.equal(f.source.visible, false);
  tv.dispose(); tv.dispose();
  assert.equal(f.model.children.length, 1);
  assert.equal(f.source.visible, true);
});

test('configured TV pauses offscreen, reuses its texture and frees media on teardown', async t => {
  const f = fixture(t), tv = bindStationEducationVideo(f.model, '/test.mp4');
  assert.equal(f.video.loop, true);
  assert.equal(f.video.muted, true);
  assert.equal(f.video.playsInline, true);
  assert.equal(f.video.preload, 'none', 'do not compete with model startup before activation');
  const screen = f.model.getObjectByName('nurse-station-education-video') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  assert.equal(f.stats.plays, 0);
  tv.setActive(true); await Promise.resolve();
  const texture = screen.material.map as THREE.VideoTexture;
  assert.ok(texture.isVideoTexture);
  assert.equal(texture.flipY, false);
  tv.setActive(false);
  assert.equal(f.stats.pauses, 1);
  tv.setActive(true); await Promise.resolve();
  assert.equal(screen.material.map, texture);
  let disposed = 0;
  texture.addEventListener('dispose', () => disposed++);
  tv.dispose(); tv.dispose();
  assert.equal(disposed, 1);
  assert.equal(f.video.src, '');
  assert.equal(f.stats.unloads, 1);
});

test('late play resolution cannot resume an inactive or disposed scene', async t => {
  const f = fixture(t);
  let resolve!: () => void;
  f.video.playResult = new Promise<void>(done => { resolve = done; });
  const tv = bindStationEducationVideo(f.model, '/test.mp4');
  tv.setActive(true); tv.setActive(false); tv.dispose(); resolve(); await Promise.resolve();
  assert.equal(f.model.children.length, 1);
  assert.ok(f.stats.pauses >= 2);
});

test('failed and blocked video show explicit status instead of a black or false-playing screen', async t => {
  const f = fixture(t);
  f.video.playResult = Promise.reject(new Error('NotAllowedError'));
  const tv = bindStationEducationVideo(f.model, '/test.mp4');
  tv.setActive(true); await Promise.resolve(); await Promise.resolve();
  assert.ok(f.labels.includes('视频无法自动播放'));
  f.video.dispatchEvent(new Event('error'));
  assert.ok(f.labels.includes('视频加载失败'));
  tv.setActive(false); tv.setActive(true);
  assert.equal(f.stats.plays, 1, 'failed media must not spin in a retry loop');
  tv.dispose();
});
