import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../docs/superpowers/previews/station-modeler-v4.html', import.meta.url);
const scriptPath = new URL('../docs/superpowers/previews/station-modeler-v4.js', import.meta.url);

const [html, script] = await Promise.all([
  readFile(htmlPath, 'utf8'),
  readFile(scriptPath, 'utf8'),
]);

assert.match(html, /护士站医院融合版预览/);
assert.match(html, /station-modeler-v4\.js/);
assert.match(html, /请保持安静/);

assert.match(script, /new THREE\.PerspectiveCamera\(51, 1, 0\.1, 100\)/);
assert.match(script, /camera\.position\.set\(0, 1\.46, 5\.45\)/);
assert.match(script, /Math\.min\(8\.748 \/ initialSize\.x, 2\.3895 \/ initialSize\.y, 4\.7385 \/ initialSize\.z\)/);
assert.match(script, /model\.scale\.y \*= 1\.1/);
assert.match(script, /function createInfoTexture\(/);
assert.match(script, /床位状态/);
assert.match(script, /护理呼叫/);
assert.match(script, /今日排班/);
assert.match(script, /window\.__previewReady = true/);
assert.match(script, /canvas\.dataset\.pixelSamples/);

console.log('Nurse station V4 preview boundary checks passed.');
