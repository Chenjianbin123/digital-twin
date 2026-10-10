import { createTemplateRuntime, WebPlatformAdapter, type TP4Document, type TemplateRuntimeInstance } from '@uneven/tpl-runtime';
import { toCanvas } from 'html-to-image';
import { getFileUrlPrefix } from '@/utils/file-prefix';
import { resolveLocalAsset } from '@/core/local-asset';
import { resolveDataSource } from '@/core/data-source';
import { createSnapshotDocument } from './tp4-parser';

// 包内置空床卡引用终端文件路径；孪生平台用本地矢量图，避免依赖终端部署目录。
const EMPTY_BED_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><g fill="none" stroke="#78909c" stroke-width="5" stroke-linecap="round"><path d="M10 10v50m0-15h80v15M12 29h68a10 10 0 0 1 10 10v6H12z"/><path d="M22 20h17v9H22z"/></g></svg>')}`;
class SnapshotPlatform extends WebPlatformAdapter {
  override resolveResourceUrl(path: string): string {
    if (resolveDataSource() === 'mock') return resolveLocalAsset(path);
    return path === '/swp_upload/picture/template/img/kongchuang.png'
      ? EMPTY_BED_IMAGE : super.resolveResourceUrl(path);
  }
}

interface SnapshotOptions {
  deviceType: 'bed' | 'door';
  outputWidth: number;
  outputHeight?: number;
  calling?: boolean;
}

// 同一场景可能同时刷新许多床位，限制 DOM/图片解码的峰值占用。
let active = 0;
const waiting: Array<() => void> = [];
async function acquire(signal: AbortSignal): Promise<() => void> {
  signal.throwIfAborted();
  if (active >= 2) await new Promise<void>((resolve, reject) => {
    const start = () => { signal.removeEventListener('abort', abort); resolve(); };
    const abort = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal.reason);
    };
    waiting.push(start);
    signal.addEventListener('abort', abort, { once: true });
  });
  else active++;
  return () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('模板图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

/** 提前内嵌资源，避免截图库在跨域失败时静默丢图。缓存只在本次渲染内共享。 */
async function embedImages(root: HTMLElement, signal: AbortSignal) {
  const cache = new Map<string, string>();
  const embed = async (url: string) => {
    if (!url || url.startsWith('data:')) return url;
    if (cache.has(url)) return cache.get(url)!;
    const response = await fetch(url, { signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error('模板图片加载失败，请检查文件服务及跨域配置');
    const data = await blobDataUrl(await response.blob());
    cache.set(url, data);
    return data;
  };
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    signal.throwIfAborted();
    if (!element.getClientRects().length) continue;
    if (element instanceof HTMLImageElement && element.getAttribute('src')) {
      element.src = await embed(element.src);
      element.srcset = '';
      await element.decode();
    }
    // 背景和蒙版同样可能引用文件服务器图片。
    const style = getComputedStyle(element);
    for (const property of ['background-image', 'mask-image', '-webkit-mask-image']) {
      let value = style.getPropertyValue(property);
      for (const match of [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)])
        value = value.replace(match[0], `url("${await embed(match[1])}")`);
      if (value && value !== 'none') element.style.setProperty(property, value);
    }
    if (element instanceof SVGImageElement && element.href.baseVal)
      element.href.baseVal = await embed(element.href.baseVal);
  }
}

function nextFrame(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error('模板渲染已取消'));
    const frame = requestAnimationFrame(() => finish());
    // 后台标签页会暂停 rAF，不能让快照一直占着并发名额。
    const timer = setTimeout(() => finish(), 50);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function fitBuiltinEmptyCards(root: HTMLElement, rootFontSize: number) {
  // 0.2.4 内置卡片用百分比纵向 padding 和页面 rem，小尺寸屏幕会溢出。
  // 仅修正包内置空床占位，不干预模板作者定义的组件样式。
  for (const card of root.querySelectorAll<HTMLElement>('.swp-tp4-empty-bed-preview, .swp-tp4-bed-list__item--empty')) {
    if (!card.classList.contains('swp-tp4-empty-bed-preview') && !card.querySelector('.swp-tp4-empty-bed__name')) continue;
    card.style.padding = '0 4%';
    card.style.minHeight = '0';
    for (const child of card.children) {
      if (!(child instanceof HTMLElement)) continue;
      child.style.minWidth = '0';
      child.style.minHeight = '0';
      if (child instanceof HTMLImageElement) child.style.maxHeight = '70%';
      else child.style.fontSize = `${rootFontSize}px`;
    }
  }
}

export async function renderRuntimeToCanvas(
  template: TP4Document,
  data: Record<string, unknown>,
  options: SnapshotOptions,
): Promise<HTMLCanvasElement> {
  let release: (() => void) | undefined;
  const host = document.createElement('div');
  host.dataset.templateRuntimeHost = '';
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  Object.assign(host.style, {
    position: 'fixed', left: '-20000px', top: '0', pointerEvents: 'none',
    width: `${template.meta.frame.width}px`, height: `${template.meta.frame.height}px`,
    fontFamily: '"Microsoft YaHei", sans-serif', colorScheme: 'light',
    contain: 'layout style paint',
  });
  const controller = new AbortController();
  let runtime: TemplateRuntimeInstance | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // 超时包含排队时间；旧场景的大批慢任务不能逐个再占满 15 秒。
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error('模板渲染超时，请检查图片资源后重试');
        controller.abort(error);
        reject(error);
      }, 15_000);
    });
    release = await Promise.race([acquire(controller.signal), timedOut]);
    controller.signal.throwIfAborted();
    document.body.appendChild(host);
    runtime = createTemplateRuntime({
      container: host,
      // 运行时会规范化文档，每次使用独立副本，避免同一模板被不同床位互相修改。
      template: createSnapshotDocument(template),
      deviceType: options.deviceType,
      platformAdapter: new SnapshotPlatform(template.meta.systemType, getFileUrlPrefix() || window.location.origin),
      dataProvider: {
        start(context) {
          for (const [source, value] of Object.entries(data))
            context.data.set(source, context.device.normalizeRuntimeData?.(source, value) ?? value);
        },
        getSnapshot: source => data[source],
        destroy() {},
      },
    });
    const instance = runtime;
    const render = async () => {
      await instance.mount();
      // QR 生成与自适应字体在微任务/下一帧完成后才可截取。
      await document.fonts.ready;
      await nextFrame(controller.signal);
      await nextFrame(controller.signal);
      controller.signal.throwIfAborted();
      const root = host.firstElementChild as HTMLElement | null;
      if (!root) throw new Error('模板运行时未生成画面');
      fitBuiltinEmptyCards(root, template.meta.rootFontSize);
      if (root.querySelector('video, iframe'))
        throw new Error('三维模板纹理暂不支持视频或嵌入网页');
      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        element.style.animation = 'none';
        element.style.transition = 'none';
      }
      await embedImages(root, controller.signal);
      const diagnostics = instance.getDiagnostics();
      if (diagnostics.skippedWidgets.length || diagnostics.bindingErrors.length
        || diagnostics.resourceErrors.some(error => error.code === 'QRCODE_RENDER_FAILED'))
        throw new Error('模板含未支持的组件或无效绑定，请检查 TP4 配置');
      const frame = template.meta.frame;
      const scale = Math.min(options.outputWidth / frame.width,
        (options.outputHeight ?? Infinity) / frame.height, 2048 / frame.width, 2048 / frame.height);
      const width = Math.max(1, Math.round(frame.width * scale));
      const height = Math.max(1, Math.round(frame.height * scale));
      const canvas = await toCanvas(root, {
        canvasWidth: width, canvasHeight: height, pixelRatio: 1,
        // 使用宿主本地字体；不扫描或下载整个应用的外部字体表。
        skipFonts: true, includeQueryParams: true,
        fetchRequestInit: { signal: controller.signal, credentials: 'same-origin' },
        onImageErrorHandler: () => { throw new Error('模板图片无法转换为纹理'); },
      });
      controller.signal.throwIfAborted();
      if (options.calling) {
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#d81b60';
        ctx.fillRect(width - 100, 8, 92, 30);
        ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('呼叫中', width - 80, 29);
      }
      return canvas;
    };
    return await Promise.race([render(), timedOut]);
  } finally {
    clearTimeout(timeout);
    controller.abort();
    try { runtime?.destroy(); }
    finally { host.remove(); release?.(); }
  }
}
