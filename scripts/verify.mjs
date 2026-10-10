import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { releasePreflight, checkAssets, runProcess, runRequiredCommands, overallStatus, saveReport, MANUAL_CHECKS } from './verify-support.mjs';
import { BROWSER_CHECKS, runBrowserChecks } from './verify-browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const flags = process.argv.slice(2);
if (flags.some(flag => !['--preflight-only', '--no-browser'].includes(flag))) {
  console.error('仅支持 --preflight-only 或 --no-browser；两者均不代表完整验收。');
  process.exitCode = 2;
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = resolve(root, `output/playwright/verify-${stamp}-${randomUUID().slice(0, 8)}`);
  await mkdir(directory, { recursive: true });
  const names = ['发布前检查', '单元与边界测试', '类型检查', '生产构建', '构建资源核对', ...BROWSER_CHECKS.map(([, label]) => label), '无未模拟的真实接口请求'];
  const report = { startedAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }) + ' Asia/Shanghai',
    status: 'incomplete', releaseApproval: 'manual-required', nodeVersion: process.versions.node,
    steps: names.map(name => ({ name, status: 'not-run' })), manualChecks: MANUAL_CHECKS, screenshots: [] };
  const persist = async () => { report.status = overallStatus(report.steps); await saveReport(directory, report); };
  const update = async (name, status, note, started = Date.now()) => {
    let step = report.steps.find(item => item.name === name);
    if (!step) { step = { name }; report.steps.push(step); }
    Object.assign(step, { status, note, durationSeconds: Math.round((Date.now() - started) / 100) / 10 });
    console.log(`[${status}] ${name}${note ? `：${note}` : ''}`);
    await persist();
  };
  try {
    await persist();
    const started = Date.now();
    report.preflight = await releasePreflight(root);
    await update('发布前检查', report.preflight.passed ? 'passed' : 'failed', report.preflight.git.changes.length ? '存在未提交或未跟踪文件；已列入报告，需人工确认发布范围。' : undefined, started);
    if (report.preflight.passed && !flags.includes('--preflight-only')) {
      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw Error('请使用 npm run verify 启动');
      await runRequiredCommands([['单元与边界测试', 'test'], ['类型检查', 'typecheck'], ['生产构建', 'build']], async script => {
        console.log(`[running] npm run ${script}`);
        return runProcess(process.execPath, [npmCli, 'run', script], { cwd: root, timeoutMs: 600_000 });
      }, update);
      if (!report.steps.some(step => step.status === 'failed')) {
        const assetStart = Date.now();
        report.builtAssets = await checkAssets(root, { built: true });
        report.buildIndexSha256 = createHash('sha256').update(await readFile(resolve(root, 'dist/index.html'))).digest('hex');
        await update('构建资源核对', report.builtAssets.passed ? 'passed' : 'failed', undefined, assetStart);
        if (report.builtAssets.passed && !flags.includes('--no-browser')) report.screenshots = await runBrowserChecks(root, directory, update);
      }
    }
  } catch {
    await update('验收运行器', 'failed', '运行器或文件检查未完成；检查依赖、权限和文件是否存在，报告不包含原始配置内容。');
  } finally {
    report.finishedAt = new Date().toISOString();
    await persist();
    console.log(`报告：${directory}/report.md`);
    console.log('发布仍需人工确认生产配置、现场验收与回滚条件。本命令未提交或部署。');
    process.exitCode = report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
  }
}
