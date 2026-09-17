import { readFileSync } from 'node:fs';

// Legacy markup/style boundary checks follow the explicit owners after App extraction.
// Runtime behavior is covered separately by workspace-lifecycle.test.mjs.
export function readWorkspaceSource() {
  return [
    '../../src/App.vue',
    '../../src/components/workspace/DigitalTwinWorkspace.vue',
    '../../src/styles/digital-twin-workspace.scss',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
}
