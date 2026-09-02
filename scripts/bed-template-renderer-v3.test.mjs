import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/core/template/canvas-renderer.ts', import.meta.url), 'utf8');

assert.match(source, /function getChildRect/);
assert.match(source, /async function renderTemplateNodes/);
assert.match(source, /renderTemplateNodes\(/);
assert.match(source, /resolveText\(node\)/);
const renderNodesStart = source.indexOf('async function renderTemplateNodes');
const qrCodeBranch = source.indexOf("node.id === 'qrcode'", renderNodesStart);
const imageBranch = source.indexOf("type === 'img'", renderNodesStart);
assert.ok(qrCodeBranch >= 0, 'bed template renderer should handle QR nodes');
assert.ok(imageBranch >= 0, 'bed template renderer should handle image nodes');
assert.ok(qrCodeBranch < imageBranch, 'QR nodes need a fallback path before generic image rendering');
