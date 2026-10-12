import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';

const read = path => readFile(new URL(`../src/components/${path}`, import.meta.url), 'utf8');
const source = await read('dashboard/SidebarSectionToggle.vue');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'toggle-test', inlineTemplate: true });
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const target = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(import.meta.url), target, target.exports);
const Toggle = target.exports.default;

for (const collapsed of [false, true]) {
  test(`section toggle exposes correct accessible state when collapsed=${collapsed}`, async () => {
    const html = await renderToString(createSSRApp(Toggle, { modelValue: collapsed, label: '病房详情', controls: 'rooms-body' }));
    assert.match(html, /type="button"/);
    assert.match(html, new RegExp(`aria-expanded="${!collapsed}"`));
    assert.match(html, /aria-controls="rooms-body"/);
    assert.match(html, new RegExp(`aria-label="${collapsed ? '展开' : '收起'}病房详情"`));
  });
}

test('click toggles only its own state and does not bubble into room navigation', () => {
  for (const collapsed of [false, true]) {
    const events = [];
    let stopped = false;
    const render = Toggle.setup({ modelValue: collapsed, label: '测试区块', controls: 'test-body' }, { expose() {}, emit: (...args) => events.push(args) });
    const vnode = render({}, []);
    vnode.props.onClick({ stopPropagation() { stopped = true; } });
    assert.equal(stopped, true);
    assert.deepEqual(events, [['update:modelValue', !collapsed]]);
  }
});

test('shared panels opt in to folding and keep hidden content mounted', async () => {
  for (const file of ['HospitalIntroPanel.vue', 'AlertTaskPanel.vue', 'StatusHistory.vue']) {
    const panel = await read(file);
    assert.match(panel, /collapsible\?: boolean/);
    assert.match(panel, /const collapsed = ref\(false\)/);
    assert.match(panel, /v-show="!collapsible \|\| !collapsed"/);
    assert.doesNotMatch(panel, /collapsible:\s*true/);
  }
  const heading = await read('dashboard/DashSectionHeader.vue');
  assert.equal((heading.match(/<slot name="actions"/g) ?? []).length, 1);
  const alerts = await read('AlertTaskPanel.vue');
  assert.match(alerts, /v-if="collapsible && collapsed"[\s\S]*?taskCounts.active[\s\S]*?queuePresentation.notice/);
  assert.match(source, /prefers-reduced-motion/);
});

test('light theme hides only the history decoration, not its expand control', async () => {
  const { descriptor: history } = parse(await read('StatusHistory.vue'));
  const style = compileStyle({ source: history.styles[0].content, filename: fileURLToPath(new URL('../src/components/StatusHistory.vue', import.meta.url)), id: 'history-test', scoped: true, preprocessLang: 'scss' });
  assert.deepEqual(style.errors, []);
  assert.match(style.code, /\.status-history::before\s*\{\s*display: none !important;/);
  assert.doesNotMatch(style.code, /\.status-history\s*\{[^}]*display: none/);
});
