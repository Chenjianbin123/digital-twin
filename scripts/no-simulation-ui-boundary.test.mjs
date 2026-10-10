import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

async function vueFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith('.vue') ? [path] : [];
  }));
  return groups.flat();
}

test('visible components and local record labels contain no simulation prompts', async () => {
  const paths = [...await vueFiles(new URL('../src/components/', import.meta.url)),
    new URL('../src/App.vue', import.meta.url),
    new URL('../src/mock/clinical-records.ts', import.meta.url),
    new URL('../src/core/ai-assistant-demo.ts', import.meta.url)];
  for (const path of paths) assert.doesNotMatch(await readFile(path, 'utf8'), /模拟|演示/, path.pathname);
});

test('scene navigation has no simulation control', async () => {
  const nav = await readFile(new URL('../src/components/dashboard/DashboardBottomNav.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(nav.split('<style')[0], /dash-bottom__sim|toggleSimulation/);
});
