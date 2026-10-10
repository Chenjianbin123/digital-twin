import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { makeTP4, makeBed } from './fixtures/tp4-runtime-fixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const stateKey = '__tp4TemplateRefreshTest';
const originalNow = Date.now;
let now = originalNow();
Date.now = () => now;

const state = {
  calls: [],
  query: async () => { throw new Error('Unexpected template request'); },
  prefix: async () => {},
  render: async () => { throw new Error('Unexpected texture render'); },
  statuses: [],
};
globalThis[stateKey] = state;

// Stub only the network and canvas boundaries; load the real cache and npm parser.
const server = await createServer({
  root, configFile: false, envDir: false, appType: 'custom', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{
    name: 'tp4-refresh-test-boundaries', enforce: 'pre',
    load(id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      const ref = `globalThis[${JSON.stringify(stateKey)}]`;
      if (path.endsWith('/src/api/template.ts'))
        return `export async function queryTemplateById(id) { const state = ${ref}; state.calls.push(id); return state.query(id); }`;
      if (path.endsWith('/src/utils/file-prefix.ts'))
        return `export async function waitForFileUrlPrefix() { return ${ref}.prefix(); }
          export function getFileUrlPrefix() { return ''; }
          export function isFileUrlPrefixLoading() { return false; }`;
      if (path.endsWith('/src/core/template/bed-terminal-texture.ts'))
        return `export function renderBedTerminalTexture(...args) { return ${ref}.render(...args); }
          export function createBedTemplateStatusTexture(bed, status) {
            ${ref}.statuses.push(status); return { status, dispose() {} };
          }
          export function createFallbackBedTerminalTexture() { throw new Error('Unexpected fallback'); }`;
    },
  }],
});

const cache = await server.ssrLoadModule('/src/core/template/template-cache.ts');
const { WardScene } = await server.ssrLoadModule('/src/core/ward-scene.ts');
after(async () => {
  Date.now = originalNow;
  delete globalThis[stateKey];
  await server.close();
});
beforeEach(() => {
  cache.clearTemplateCache();
  now += 1_000_000;
  state.calls = [];
  state.prefix = async () => {};
  state.query = async () => { throw new Error('Unexpected template request'); };
  state.statuses = [];
  state.render = async () => { throw new Error('Unexpected texture render'); };
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function template(version) {
  const document = makeTP4();
  document.meta.name = version;
  document.pages[0].regions[0].widget.content.static = version;
  return { id: 42, templateName: version, templateContent: JSON.stringify(document) };
}

function title(parsed) {
  assert.equal(parsed.document.schemaVersion, 4);
  return parsed.document.pages[0].regions[0].widget.content.static;
}

test('concurrent screens sharing a template ID make one request and share parsed TP4', async () => {
  const response = deferred();
  state.query = () => response.promise;
  const first = cache.loadParsedTemplate(42);
  const second = cache.loadParsedTemplate(42);
  assert.deepEqual(state.calls, [42]);
  response.resolve(template('original'));
  const [a, b] = await Promise.all([first, second]);
  assert.equal(title(a), 'original');
  assert.strictEqual(a, b);
  assert.strictEqual(await cache.loadParsedTemplate(42), a);
  assert.deepEqual(state.calls, [42]);
});

test('same ID is revalidated at TTL expiry and an updated TP4 body is reparsed', async () => {
  let current = template('before edit');
  state.query = async () => current;
  const old = await cache.loadParsedTemplate(42);
  current = template('after edit');
  now += cache.TEMPLATE_CACHE_TTL_MS - 1;
  assert.strictEqual(await cache.loadParsedTemplate(42), old);
  assert.equal(state.calls.length, 1);
  now++;
  const updated = await cache.loadParsedTemplate(42);
  assert.equal(title(updated), 'after edit');
  assert.notStrictEqual(updated, old);
  assert.deepEqual(state.calls, [42, 42]);
});

test('unchanged TP4 is reused after server revalidation', async () => {
  state.query = async () => template('unchanged');
  const original = await cache.loadParsedTemplate(42);
  now += cache.TEMPLATE_CACHE_TTL_MS;
  assert.strictEqual(await cache.loadParsedTemplate(42), original);
  assert.deepEqual(state.calls, [42, 42]);
});

test('manual clearing advances generation and reloads the same ID immediately', async () => {
  let current = template('before refresh');
  state.query = async () => current;
  const old = await cache.loadParsedTemplate(42);
  const previousGeneration = cache.getTemplateCacheGeneration();
  current = template('after refresh');
  cache.clearTemplateCache();
  assert.equal(cache.getTemplateCacheGeneration(), previousGeneration + 1);
  const refreshed = await cache.loadParsedTemplate(42);
  assert.equal(title(refreshed), 'after refresh');
  assert.notStrictEqual(refreshed, old);
  assert.deepEqual(state.calls, [42, 42]);
});

test('a response arriving after clear cannot populate caches or issue a recursive request', async () => {
  const oldResponse = deferred();
  state.query = () => oldResponse.promise;
  const stale = cache.loadParsedTemplate(42);
  const rejected = assert.rejects(stale, /模板缓存已刷新，请重试/);
  cache.clearTemplateCache();
  oldResponse.resolve(template('stale generation'));
  await rejected;
  assert.deepEqual(state.calls, [42], 'stale work must not fetch under a new login or scope');
  state.query = async () => template('current generation');
  assert.equal(title(await cache.loadParsedTemplate(42)), 'current generation');
  assert.deepEqual(state.calls, [42, 42]);
});

test('a late old-generation success cannot overwrite a newer cached TP4', async () => {
  const oldResponse = deferred();
  state.query = () => oldResponse.promise;
  const stale = cache.loadParsedTemplate(42);
  const rejected = assert.rejects(stale, /模板缓存已刷新，请重试/);
  cache.clearTemplateCache();
  state.query = async () => template('new generation');
  const current = await cache.loadParsedTemplate(42);
  oldResponse.resolve(template('obsolete body'));
  await rejected;
  assert.strictEqual(await cache.loadParsedTemplate(42), current);
  assert.equal(title(current), 'new generation');
  assert.deepEqual(state.calls, [42, 42]);
});

test('a late old-generation failure cannot evict a newer successful request', async () => {
  const oldResponse = deferred();
  state.query = () => oldResponse.promise;
  const stale = cache.loadParsedTemplate(42);
  const rejected = assert.rejects(stale, /old request failed/);
  cache.clearTemplateCache();
  state.query = async () => template('new generation');
  const current = await cache.loadParsedTemplate(42);
  oldResponse.reject(new Error('old request failed'));
  await rejected;
  assert.strictEqual(await cache.loadParsedTemplate(42), current);
  assert.deepEqual(state.calls, [42, 42]);
});

test('clearing while the resource prefix is pending also invalidates parsed work', async () => {
  const prefix = deferred();
  state.prefix = () => prefix.promise;
  state.query = async () => template('before prefix readiness');
  const stale = cache.loadParsedTemplate(42);
  const rejected = assert.rejects(stale, /模板缓存已刷新，请重试/);
  await Promise.resolve();
  cache.clearTemplateCache();
  prefix.resolve();
  await rejected;
  assert.deepEqual(state.calls, [42]);
  state.query = async () => template('after prefix readiness');
  assert.equal(title(await cache.loadParsedTemplate(42)), 'after prefix readiness');
  assert.deepEqual(state.calls, [42, 42]);
});

test('a failed current request can be retried without waiting for TTL', async () => {
  state.query = async () => { throw new Error('temporary template failure'); };
  await assert.rejects(cache.loadParsedTemplate(42), /temporary template failure/);
  state.query = async () => template('recovered');
  assert.equal(title(await cache.loadParsedTemplate(42)), 'recovered');
  assert.deepEqual(state.calls, [42, 42]);
});

function sceneFixture() {
  const bed = { ...makeBed(), templateId: 42 };
  const applied = [];
  const scene = {
    bedMeshes: new Map([[bed.bedCode, { bedTerminalScreen: {} }]]),
    terminalSignatures: new Map(),
    bedTerminalRefreshToken: new Map(),
    applyBedTerminalTexture(_mesh, texture) { applied.push(texture); },
  };
  return { bed, applied, refresh: () => WardScene.prototype.refreshBedTerminal.call(scene, bed) };
}

function texture(name) {
  return { name, disposed: false, dispose() { this.disposed = true; } };
}

test('bed screen disposes an in-flight texture completed after template cache clear', async () => {
  state.query = async () => template('old');
  const renderStarted = deferred();
  const rendered = deferred();
  state.render = () => { renderStarted.resolve(); return rendered.promise; };
  const fixture = sceneFixture();
  const pending = fixture.refresh();
  await renderStarted.promise;
  cache.clearTemplateCache();
  const stale = texture('stale');
  rendered.resolve(stale);
  await pending;
  assert.equal(stale.disposed, true);
  assert.deepEqual(fixture.applied, []);
  assert.deepEqual(state.statuses, []);
});

test('bed screen ignores an in-flight render failure from the cleared generation', async () => {
  state.query = async () => template('old');
  const renderStarted = deferred();
  const rendered = deferred();
  state.render = () => { renderStarted.resolve(); return rendered.promise; };
  const fixture = sceneFixture();
  const pending = fixture.refresh();
  await renderStarted.promise;
  cache.clearTemplateCache();
  rendered.reject(new Error('obsolete render failed'));
  await pending;
  assert.deepEqual(fixture.applied, []);
  assert.deepEqual(state.statuses, [], 'obsolete failure must not replace the screen with an error');
});

test('bed screen refreshes an unchanged bed immediately after manual template cache clear', async () => {
  let current = 'before refresh';
  state.query = async () => template(current);
  state.render = async (_bed, parsed) => texture(title(parsed));
  const fixture = sceneFixture();
  await fixture.refresh();
  await fixture.refresh();
  assert.deepEqual(fixture.applied.map(item => item.name), ['before refresh']);
  current = 'after refresh';
  cache.clearTemplateCache();
  await fixture.refresh();
  assert.deepEqual(fixture.applied.map(item => item.name), ['before refresh', 'after refresh']);
  assert.deepEqual(state.calls, [42, 42]);
});

test('bed screen merges long in-flight work and measures TTL from successful completion', async () => {
  const response = deferred();
  const renderStarted = deferred();
  const rendered = deferred();
  let renderCalls = 0;
  state.query = () => response.promise;
  state.render = () => { renderCalls++; renderStarted.resolve(); return rendered.promise; };
  const fixture = sceneFixture();
  const pending = fixture.refresh();
  now += 100_000;
  response.resolve(template('initial'));
  await renderStarted.promise;
  now += cache.TEMPLATE_CACHE_TTL_MS;
  await fixture.refresh();
  assert.equal(renderCalls, 1, 'slow in-flight work must not duplicate after the TTL interval');
  assert.deepEqual(state.calls, [42]);
  rendered.resolve(texture('initial'));
  await pending;
  state.query = async () => template('updated');
  state.render = async (_bed, parsed) => texture(title(parsed));
  now += cache.TEMPLATE_CACHE_TTL_MS - 1;
  await fixture.refresh();
  assert.deepEqual(state.calls, [42]);
  now++;
  await fixture.refresh();
  assert.deepEqual(state.calls, [42, 42]);
  assert.deepEqual(fixture.applied.map(item => item.name), ['initial', 'updated']);
});
