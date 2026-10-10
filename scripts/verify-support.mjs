import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, stat, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export const MANUAL_CHECKS = [
  '确认本次发布范围；工作区清单不是提交或发布授权。',
  '由部署人员确认生产数据源、服务地址、HTTPS/CORS、权限和服务器目录；本报告不读取私有环境文件。',
  '在测试病区验证真实呼叫/输液 0→1、巡视房床归属、声音提醒、断网恢复及长时间运行。',
  '确认上一版完整产物、配套配置及回滚权限；本命令不部署。',
];

export function commandResult(output, exitCode) {
  if (exitCode !== 0 || /^### Error/m.test(output)) return false;
  const match = output.match(/^### Result\r?\n([^\r\n]+)/m);
  try { return Boolean(match && JSON.parse(match[1]).passed === true); }
  catch { return false; }
}

export function overallStatus(steps) {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  return steps.length && steps.every(step => step.status === 'passed') ? 'passed' : 'incomplete';
}

export async function runRequiredCommands(commands, execute, update) {
  for (const [name, script] of commands) {
    const started = Date.now();
    const result = await execute(script);
    await update(name, result.exitCode === 0 ? 'passed' : 'failed', result.exitCode === 0 ? undefined : `命令失败或超时，请单独运行 npm run ${script} 查看详情。`, started);
    if (result.exitCode !== 0) return false;
  }
  return true;
}

// No shell expansion and no raw command output in the shareable report.
export function runProcess(command, args, { cwd, timeoutMs = 120_000, env = process.env } = {}) {
  return new Promise(resolveResult => {
    let output = '', timedOut = false, finished = false, cleanupTimer;
    const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = code => {
      if (finished) return;
      finished = true; clearTimeout(timer); clearTimeout(cleanupTimer);
      resolveResult({ exitCode: code, output, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.on('error', () => child.kill());
          killer.on('close', code => { if (code !== 0) child.kill(); });
        } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); } }
      }
      cleanupTimer = setTimeout(() => {
        child.kill(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(-1);
      }, 5000);
    }, timeoutMs);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-4_000_000); });
    child.on('error', () => finish(-1));
    child.on('close', code => finish(timedOut ? -1 : code ?? -1));
  });
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(ts|vue)$/.test(path) && !/\.test\./.test(path)) files.push(path);
  }
  return files;
}

export function assetReferences(source) {
  return [...source.matchAll(/(['"`])(\/(?:models|videos|draco)\/[^'"`\r\n]*?)\1/g)].map(match => match[2]);
}

export async function checkAssets(root, { built = false, outDir = 'dist' } = {}) {
  const refs = new Map(), dynamic = [];
  for (const file of await sourceFiles(resolve(root, 'src'))) {
    for (const ref of assetReferences(await readFile(file, 'utf8'))) {
      if (ref.includes('${')) { dynamic.push(relative(root, file).replaceAll('\\', '/')); continue; }
      const url = ref.split(/[?#]/)[0];
      const urls = url === '/draco/' ? ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'].map(name => url + name) : [url];
      for (const item of urls) refs.set(item, [...new Set([...(refs.get(item) ?? []), relative(root, file).replaceAll('\\', '/')])]);
    }
  }
  const directory = resolve(root, built ? outDir : 'public');
  const base = await realpath(directory);
  const assets = [];
  for (const [url, owners] of refs) {
    const path = resolve(directory, '.' + url);
    let valid = false, bytes = 0;
    try {
      const actual = await realpath(path);
      const info = await stat(actual);
      valid = actual.startsWith(base + sep) && info.isFile() && info.size > 0;
      bytes = info.size;
    } catch { /* Missing files are explicit failures below. */ }
    assets.push({ url, owners, present: valid, bytes });
  }
  return { passed: refs.size > 0 && !dynamic.length && assets.every(asset => asset.present), assets, dynamic: [...new Set(dynamic)] };
}

export function parseGitChanges(output) {
  const records = output.split('\0').filter(Boolean), changes = [];
  for (let i = 0; i < records.length; i++) {
    const status = records[i].slice(0, 2), path = records[i].slice(3);
    const item = { status, path };
    if (/[RC]/.test(status)) item.previousPath = records[++i];
    changes.push(item);
  }
  return changes;
}

export async function releasePreflight(root) {
  const checks = [];
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  const locked = lock.packages?.[''];
  const sameDependencies = locked && ['dependencies', 'devDependencies'].every(key => {
    const a = pkg[key] ?? {}, b = locked[key] ?? {};
    return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([name, version]) => b[name] === version);
  });
  checks.push({ name: 'package-lock 与依赖声明一致', passed: Boolean(sameDependencies) });
  checks.push({ name: 'Node.js 至少 22.18（内置 TypeScript 测试）', passed: Number(process.versions.node.split('.')[0]) > 22 || (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) >= 18) });
  for (const key of ['test', 'typecheck', 'build']) checks.push({ name: `存在 ${key} 命令`, passed: Boolean(pkg.scripts?.[key]) });
  const assets = await checkAssets(root);
  checks.push({ name: '源码静态引用资源完整（含保留的旧配置）', passed: assets.passed });
  const git = await runProcess('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root });
  const head = await runProcess('git', ['rev-parse', 'HEAD'], { cwd: root });
  checks.push({ name: '可读取 Git 发布范围清单', passed: git.exitCode === 0 && head.exitCode === 0 });
  return { passed: checks.every(check => check.passed), checks, assets,
    git: { head: /^[0-9a-f]{40,64}$/.test(head.output.trim()) ? head.output.trim() : null, changes: parseGitChanges(git.output) },
    lockSha256: createHash('sha256').update(await readFile(resolve(root, 'package-lock.json'))).digest('hex'),
    configuration: { status: 'manual', note: MANUAL_CHECKS[1] },
  };
}

export async function saveReport(directory, report) {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const labels = { passed: '通过', failed: '失败', 'not-run': '未执行', incomplete: '未完成' };
  const text = ['# 上线候选版自动验收', '', `- 开始时间：${report.startedAt}`, `- 自动检查：${labels[report.status]}`,
    '- 发布结论：待人工确认，不代表可直接上线。', '- 浏览器采用隔离合成数据；未验证真实后端和生产配置。', '',
    '| 检查 | 结果 | 耗时（秒） |', '| --- | --- | --- |',
    ...report.steps.map(step => `| ${step.name} | ${labels[step.status]} | ${step.durationSeconds ?? '-'} |`), '',
    ...report.steps.filter(step => step.note).map(step => `- ${step.name}：${step.note}`), '',
    '## 待人工确认', '', ...MANUAL_CHECKS.map(item => `- [ ] ${item}`), '',
    '## 证据', '', '- report.json：资源检查、工作区文件清单、命令结果及截图路径（不含配置值）。',
    ...(report.screenshots ?? []).map(path => `- [${path.split('/').pop()}](./${path})`), '',
  ].join('\n');
  await writeFile(resolve(directory, 'report.md'), text);
}
