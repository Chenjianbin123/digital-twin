import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { preview } from 'vite';
import { deploymentEndpoints } from '../src/core/deployment-endpoints.ts';
import { parseRuntimeConfig } from '../src/core/runtime-config.ts';
import { findBrowserCli, prepareBrowserCheck } from './verify-browser.mjs';
import { checkAssets, commandResult, overallStatus, runProcess, saveReport } from './verify-support.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = process.env.VERIFY_DEPLOYMENT_DIST?.trim() || 'dist';
const directory = resolve(root, `output/playwright/verify-deployment-${Date.now()}-${randomUUID().slice(0, 8)}`);
const report = { startedAt: new Date().toISOString(), status: 'incomplete', releaseApproval: 'manual-required',
  steps: ['目标地址配置', '实际构建资源 HTTP 访问', '生产包登录地址与异常重试', '验收前后入口文件一致'].map(name => ({ name, status: 'not-run' })), screenshots: [] };
let server, opened = false, cli;
const session = `deployment-${process.pid}-${Date.now()}`;
const invoke = args => runProcess(process.execPath, [cli, `-s=${session}`, ...args], { cwd: directory, timeoutMs: 120_000 });
const update = async (name, status, note) => {
  let step = report.steps.find(item => item.name === name);
  if (!step) { step = { name }; report.steps.push(step); }
  Object.assign(step, { status, note });
  console.log(`[${status}] ${name}${note ? `：${note}` : ''}`);
};
try {
  await mkdir(directory, { recursive: true });
  // Check the deployed public configuration, never private dotenv contents.
  const configPath = resolve(root, outDir, 'config.json');
  const configContents = await readFile(configPath, 'utf8');
  const endpoints = deploymentEndpoints(parseRuntimeConfig(JSON.parse(configContents)).deviceHost);
  report.configuration = endpoints;
  await update('目标地址配置', 'passed');
  report.buildDirectory = resolve(root, outDir);
  const buildIndex = resolve(root, outDir, 'index.html');
  report.buildIndexSha256 = createHash('sha256').update(await readFile(buildIndex)).digest('hex');
  const assets = await checkAssets(root, { built: true, outDir });
  if (!assets.passed) throw Error('构建资源检查未通过');
  server = await preview({ root, configFile: false, envDir: false, envPrefix: 'DEPLOYMENT_VERIFY_UNUSED_', logLevel: 'silent',
    build: { outDir }, preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw Error('预览未监听');
  const origin = `http://127.0.0.1:${address.port}`;
  report.assets = [];
  for (const asset of assets.assets) {
    const response = await fetch(origin + asset.url, { headers: { Range: 'bytes=0-31' }, redirect: 'error', signal: AbortSignal.timeout(5000) });
    const passed = response.status === 206 && response.headers.get('content-range') === `bytes 0-31/${asset.bytes}`;
    await response.body?.cancel();
    report.assets.push({ url: asset.url, passed, status: response.status });
  }
  await update('实际构建资源 HTTP 访问', report.assets.every(item => item.passed) ? 'passed' : 'failed', `${report.assets.length} 项模型、视频和解码资源；不代表模型内部或真实文件服务验收。`);
  cli = await findBrowserCli(root);
  if (!cli) await update('生产包登录地址与异常重试', 'not-run', '未找到 Playwright CLI，请配置 VERIFY_PLAYWRIGHT_CLI。');
  else {
    const config = resolve(directory, 'browser-config.json');
    await writeFile(config, JSON.stringify({ browser: { launchOptions: { headless: true }, contextOptions: { serviceWorkers: 'block' } } }));
    opened = true;
    const start = await invoke(['open', 'about:blank', `--config=${config}`]);
    if (start.exitCode !== 0 || /^### Error/m.test(start.output)) throw Error('浏览器未启动');
    const source = await readFile(resolve(root, 'scripts/deployment-built.browser-check.cjs'), 'utf8');
    const check = resolve(directory, 'production-check.cjs');
    await writeFile(check, prepareBrowserCheck(source, origin, directory).replace('__EXPECTED_API_ORIGIN__', new URL(endpoints.apiBase).origin));
    const checked = await invoke(['run-code', '--filename', check]);
    const passed = commandResult(checked.output, checked.exitCode);
    if (!passed) console.error(checked.output.match(/^### Error\r?\n([^\r\n]*)/m)?.[1] ?? '浏览器未返回明确通过结果');
    await update('生产包登录地址与异常重试', passed ? 'passed' : 'failed', '测试真实 dist，登录响应为隔离合成数据，不发送真实登录请求。');
    if (passed) report.screenshots.push('production-login.png', 'production-config-error.png');
  }
  const finalIndexSha256 = createHash('sha256').update(await readFile(buildIndex)).digest('hex');
  const configUnchanged = await readFile(configPath, 'utf8') === configContents;
  await update('验收前后入口文件一致', finalIndexSha256 === report.buildIndexSha256 && configUnchanged ? 'passed' : 'failed',
    '入口或现场 config.json 发生变化时拒绝通过；并行构建应使用独立目录。');
}
catch {
  await update('部署验收执行', 'failed', '检查产物 config.json 的 deviceHost、已构建资源、浏览器和端口权限；未保存凭据。');
}
finally {
  if (opened) {
    const closed = await invoke(['close']);
    if (closed.exitCode !== 0 || /^### Error/m.test(closed.output)) await update('关闭验收浏览器', 'failed', `请检查本次会话 ${session}。`);
  }
  if (server) await new Promise(resolveClosed => server.httpServer.close(resolveClosed));
  report.status = overallStatus(report.steps);
  report.finishedAt = new Date().toISOString();
  await saveReport(directory, report);
  console.log(`报告：${directory}/report.md`);
  process.exitCode = report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
}
