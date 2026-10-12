import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetReferences, checkAssets, commandResult, overallStatus, parseGitChanges, runRequiredCommands, runProcess, saveReport } from './verify-support.mjs';
import { prepareBrowserCheck, findBrowserCli, isFixtureRequest } from './verify-browser.mjs';

async function sandbox(t) {
  const directory = await mkdtemp(join(tmpdir(), 'digital-twin-verify-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('CLI exit zero without an explicit passed result never qualifies as successful verification', () => {
  assert.equal(commandResult('### Result\n{"passed":true}\n### Ran code', 0), true);
  for (const output of ['', '### Error\nfailed', '### Result\n{"passed":false}', '### Result\nnot-json', '### Result\n{"passed":true}\n### Error\nlate failure']) assert.equal(commandResult(output, 0), false);
  assert.equal(commandResult('### Result\n{"passed":true}', 1), false);
  assert.equal(overallStatus([{status:'passed'},{status:'not-run'}]), 'incomplete');
  assert.equal(overallStatus([{status:'failed'},{status:'not-run'}]), 'failed');
  assert.equal(overallStatus([{status:'passed'}]), 'passed');
});

test('failed prerequisite stops subsequent build commands and reports the failing step', async () => {
  const executed = [], reported = [];
  assert.equal(await runRequiredCommands([['test','test'],['typecheck','typecheck'],['build','build']], async script => {
    executed.push(script); return {exitCode:1};
  }, async (...args) => reported.push(args)), false);
  assert.deepEqual(executed, ['test']); assert.equal(reported[0][1], 'failed');
});

test('resource checks strip versions, exclude tests and detect empty or missing build resources', async t => {
  const root = await sandbox(t);
  await mkdir(join(root, 'src')); await mkdir(join(root, 'public/models'), {recursive:true});
  await mkdir(join(root, 'dist/models'), {recursive:true});
  await writeFile(join(root, 'src/config.ts'), 'const model="/models/ward.glb?v=1";');
  await writeFile(join(root, 'src/config.test.ts'), 'const ignored="/models/missing-test.glb";');
  await writeFile(join(root, 'public/models/ward.glb'), 'synthetic');
  assert.equal((await checkAssets(root)).passed, true);
  assert.equal((await checkAssets(root, {built:true})).passed, false);
  await writeFile(join(root, 'dist/models/ward.glb'), '');
  assert.equal((await checkAssets(root, {built:true})).passed, false);
  await writeFile(join(root, 'dist/models/ward.glb'), 'synthetic');
  assert.equal((await checkAssets(root, {built:true})).passed, true);
  await writeFile(join(root, 'src/config.ts'), 'const model=`/models/${name}.glb`;');
  assert.equal((await checkAssets(root)).passed, false, 'dynamic references require explicit review');
});

test('resource paths cannot escape the checked public directory', async t => {
  const root = await sandbox(t);
  await mkdir(join(root, 'src')); await mkdir(join(root, 'public/models'), {recursive:true});
  await writeFile(join(root, 'outside.glb'), 'synthetic');
  await writeFile(join(root, 'src/config.ts'), 'const model="/models/../../outside.glb";');
  assert.equal((await checkAssets(root)).passed, false);
  assert.deepEqual(assetReferences('const video = "/videos/care.mp4?x=1";'), ['/videos/care.mp4?x=1']);
});

test('isolated build resources are checked without falling back to shared dist', async t => {
  const root = await sandbox(t);
  const outDir = 'output/isolated-build';
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'dist/models'), { recursive: true });
  await mkdir(join(root, outDir, 'models'), { recursive: true });
  await writeFile(join(root, 'src/config.ts'), 'const model="/models/ward.glb";');
  await writeFile(join(root, 'dist/models/ward.glb'), 'shared-build');
  assert.equal((await checkAssets(root, { built: true, outDir })).passed, false);
  await writeFile(join(root, outDir, 'models/ward.glb'), 'isolated-build');
  assert.equal((await checkAssets(root, { built: true, outDir })).passed, true);
  await writeFile(join(root, 'src/config.ts'), 'const model="/models/../../../dist/models/ward.glb";');
  assert.equal((await checkAssets(root, { built: true, outDir })).passed, false);
});

test('git changes preserve renamed and untracked files without mutating them', () => {
  assert.deepEqual(parseGitChanges(' M src/a.ts\0R  new name.ts\0old name.ts\0?? new.glb\0'), [
    {status:' M',path:'src/a.ts'}, {status:'R ',path:'new name.ts',previousPath:'old name.ts'}, {status:'??',path:'new.glb'},
  ]);
});

test('browser checks are relocated to an isolated port and per-run artifact directory', () => {
  const source = "page.goto('http://127.0.0.1:5173/a'); page.screenshot({path:'output/playwright/a.png'});";
  const result = prepareBrowserCheck(source, 'http://127.0.0.1:54321', 'E:/test folder/run');
  assert.match(result, /54321/); assert.doesNotMatch(result, /5173|output\/playwright/);
  assert.throws(() => prepareBrowserCheck(source, 'https://hospital.example', '/tmp/test'));
  const paths = [];
  const quotedDirectory = 'E:/test\'s "quoted" `folder` ${value}';
  const quotedSource = ['\'', '"', '`'].map(quote => `page.screenshot({path:${quote}output/playwright/a.png${quote}});`).join('\n');
  new Function('page', prepareBrowserCheck(quotedSource, 'http://127.0.0.1:54321', quotedDirectory))({screenshot: ({path}) => paths.push(path)});
  assert.deepEqual(paths, Array(3).fill(quotedDirectory + '/a.png'));
});

test('missing browser CLI is unavailable, never an implicit install or pass', async t => {
  assert.equal(await findBrowserCli(await sandbox(t), '/does-not-exist/playwright-cli.js'), null);
});

test('browser isolation permits only local static GET requests and rejects unknown APIs', () => {
  for (const path of ['/scripts/fixtures/nursing-copy.html', '/src/App.vue?t=123', '/@vite/client', '/models/room.glb', '/output/playwright/verify-test/.vite-cache/deps/vue.js']) assert.equal(isFixtureRequest(path), true);
  for (const path of ['/system/verification-denied', '/swp/test', '/db-adapter/test', '/api/test', '/', '/output/playwright/verify-test/report.json']) assert.equal(isFixtureRequest(path), false);
  assert.equal(isFixtureRequest('/src/App.vue', 'POST'), false);
});

test('reports preserve missing checks and manual release boundary', async t => {
  const directory = await sandbox(t);
  const report = {startedAt:'synthetic', status:'incomplete', steps:[{name:'浏览器',status:'not-run'}]};
  await saveReport(directory, report);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')), report);
  const text = await readFile(join(directory, 'report.md'), 'utf8');
  assert.match(text, /未执行/); assert.match(text, /不代表可直接上线/); assert.match(text, /真实呼叫/);
});

test('command launch errors and timeouts return failure rather than hanging or passing', async () => {
  assert.equal((await runProcess('digital-twin-nonexistent-test-command', [], {timeoutMs:1000})).exitCode, -1);
  const timed = await runProcess(process.execPath, ['-e','setInterval(()=>{},1000)'], {timeoutMs:100});
  assert.equal(timed.timedOut, true); assert.equal(timed.exitCode, -1);
});
