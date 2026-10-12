import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { commandResult, runProcess } from './verify-support.mjs';

export const BROWSER_CHECKS = [
  ['nurse-status-style', '病区状态科技风、深浅色及交互'],
  ['nurse-header', '护士站标题与展示按钮响应式布局'],
  ['nursing-copy', '三场景文案、深浅色及窄屏'],
  ['login-recovery', '登录异常与重试'],
  ['nurse-records', '分页重试及病区隔离'],
  ['nurse-operations', '筛选、重新获取与核对清单'],
  ['nurse-event-closure', '合成事件未处理到已处理闭环'],
  ['tp4-runtime', 'TP4 模板解析、纹理与资源回收'],
  ['environment-refresh', '环境刷新、有效覆盖与过期提示'],
];

export function isFixtureRequest(path, method = 'GET') {
  return method === 'GET' && /^\/(?:scripts\/fixtures\/|src\/|node_modules\/|@vite\/|@fs\/|@id\/|output\/playwright\/verify-[\w-]+\/\.vite-cache\/|models\/|videos\/|draco\/|images\/|icons\/|fonts\/|textures\/|favicon\.ico(?:\?|$))/.test(path);
}

export async function findBrowserCli(root, configured = process.env.VERIFY_PLAYWRIGHT_CLI) {
  let path = configured;
  if (!path) {
    try { path = createRequire(resolve(root, 'package.json')).resolve('@playwright/cli/playwright-cli.js'); }
    catch { return null; }
  }
  try { return (await stat(path)).isFile() && /\.[cm]?js$/.test(path) ? resolve(path) : null; }
  catch { return null; }
}

export function prepareBrowserCheck(source, origin, outputDirectory) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('测试服务必须是本地隔离地址');
  const escapedDirectory = outputDirectory.replaceAll('\\', '/').replace(/['"`]/g, '\\$&').replaceAll('${', '\\${');
  return source.replaceAll('http://127.0.0.1:5173', origin)
    .replaceAll('output/playwright/', () => escapedDirectory + '/');
}

export async function runBrowserChecks(root, directory, update) {
  const cli = await findBrowserCli(root);
  if (!cli) {
    await update('浏览器环境', 'not-run', '未找到 Playwright CLI；配置 VERIFY_PLAYWRIGHT_CLI 后重新运行，不自动安装。');
    return [];
  }
  let blockedRequests = 0;
  const server = await createServer({
    root, configFile: false, envDir: false, envPrefix: 'VERIFY_ISOLATED_UNUSED_', appType: 'mpa', logLevel: 'silent',
    // Keep the verification module graph separate from any running development server.
    cacheDir: resolve(directory, '.vite-cache'), optimizeDeps: { include: ['vue', 'pinia'] },
    plugins: [vue(), { name: 'deny-live-api', configureServer(instance) {
      instance.middlewares.use((request, response, next) => {
        if (!isFixtureRequest(request.url ?? '', request.method)) {
          blockedRequests++; response.statusCode = 503; response.end('Synthetic verification rejects unmocked API requests'); return;
        }
        next();
      });
    } }],
    resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['vue'] },
    css: { preprocessorOptions: { scss: { additionalData: '@use "@/styles/breakpoints.scss" as *;\n@use "@/styles/dashboard.scss" as *;\n' } } },
    define: { 'import.meta.env.VITE_DATA_SOURCE': '"remote"', 'import.meta.env.VITE_API_TOKEN': '""', 'import.meta.env.VITE_DEVICE_HOST': '""' },
    server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null, proxy: {} },
  });
  const session = `verify-${process.pid}-${Date.now()}`;
  const config = resolve(directory, 'browser-config.json');
  await writeFile(config, JSON.stringify({ browser: { launchOptions: { headless: true }, contextOptions: { serviceWorkers: 'block' } } }));
  const invoke = args => runProcess(process.execPath, [cli, `-s=${session}`, ...args], { cwd: directory, timeoutMs: 180_000 });
  let opened = false;
  try {
    await server.listen();
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw Error('测试服务未监听');
    const origin = `http://127.0.0.1:${address.port}`;
    opened = true;
    const start = await invoke(['open', 'about:blank', `--config=${config}`]);
    if (start.exitCode !== 0 || /^### Error/m.test(start.output)) throw Error('浏览器无法启动');
    // Context routes survive page.unrouteAll() in existing suites. No external request is forwarded.
    const setup = resolve(directory, 'browser-isolation.cjs');
    await writeFile(setup, `async page => {
      const context = page.context();
      const isFixtureRequest = ${isFixtureRequest.toString()};
      await context.addInitScript(() => sessionStorage.setItem('TokenKey', 'synthetic-verify-only'));
      let blocked = 0;
      await context.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith(${JSON.stringify(origin + '/')})) {
          const path = url.slice(${origin.length});
          if (isFixtureRequest(path, route.request().method())) return route.continue();
        }
        blocked++; await route.abort();
      });
      await page.goto(${JSON.stringify(origin + '/scripts/fixtures/login-recovery.html')});
      const leaked = await page.evaluate(async () => {
        try { await fetch('/system/verification-denied', {method:'POST'}); return true; }
        catch { return false; }
      });
      if (leaked || blocked !== 1) throw Error('网络隔离自检失败');
      await context.exposeFunction('verificationBlockedRequests', () => blocked - 1);
      return {passed:true};
    }`);
    const setupResult = await invoke(['run-code', '--filename', setup]);
    if (!commandResult(setupResult.output, setupResult.exitCode)) throw Error('浏览器隔离未建立');
    await update('浏览器隔离自检', 'passed', `未模拟请求已阻断；独立会话 ${session}。`);
    for (const [name, label] of BROWSER_CHECKS) {
      const started = Date.now();
      const source = await readFile(resolve(root, `scripts/${name}.browser-check.cjs`), 'utf8');
      const path = resolve(directory, `${name}.cjs`);
      await writeFile(path, prepareBrowserCheck(source, origin, directory));
      const result = await invoke(['run-code', '--filename', path]);
      const passed = commandResult(result.output, result.exitCode);
      await update(label, passed ? 'passed' : 'failed', passed ? undefined : '断言失败、命令超时或未返回明确通过；用对应浏览器脚本复查。', started);
      if (!passed) break;
    }
    const isolation = resolve(directory, 'browser-isolation-check.cjs');
    await writeFile(isolation, `async page => ({passed: (await page.evaluate(() => window.verificationBlockedRequests())) === 0})`);
    const checked = await invoke(['run-code', '--filename', isolation]);
    await update('无未模拟的真实接口请求', commandResult(checked.output, checked.exitCode) && !blockedRequests ? 'passed' : 'failed');
  } catch {
    await update('浏览器执行', 'failed', '测试服务、浏览器或隔离初始化失败；未将其当作通过。');
  } finally {
    if (opened) {
      const closed = await invoke(['close']);
      if (closed.exitCode !== 0 || /^### Error/m.test(closed.output)) await update('关闭验收浏览器', 'failed', '验收会话未确认关闭，请检查本次 verify 会话。');
    }
    await server.close();
  }
  return (await readdir(directory)).filter(name => name.endsWith('.png')).sort().map(name => relative(directory, resolve(directory, name)).replaceAll('\\', '/'));
}
