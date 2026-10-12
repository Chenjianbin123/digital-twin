import { parseTemplateAsTP4, type TP4Document } from '@uneven/tpl-runtime';
import type { ParsedTemplate } from '../../types/template.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** 包自身只检查 meta/pages；在创建 DOM 前拒绝空屏和异常画布尺寸。 */
export function parseTP4Template(
  raw: string | Record<string, unknown>,
  context?: Parameters<typeof parseTemplateAsTP4>[1],
): ParsedTemplate {
  const document = parseTemplateAsTP4(typeof raw === 'string' ? raw : structuredClone(raw), context);
  const { meta } = document;
  const width = meta?.frame?.width;
  const height = meta?.frame?.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || width > 8192 || height > 8192 || width * height > 16_777_216)
    throw new Error('TP4 模板尺寸无效或超出纹理渲染上限');
  if (!Number.isFinite(meta.rootFontSize) || meta.rootFontSize <= 0
    || !isRecord(document.theme) || !isRecord(document.theme.colors))
    throw new Error('TP4 模板缺少有效的字体或主题配置');
  const pages = document.pages.filter(page => page?.role !== 'patientOverviewEditor');
  if (!pages.length || (!Array.isArray(pages[0]?.regions) || !pages[0].regions.length))
    throw new Error('TP4 模板没有可显示内容');
  const keys = new Set<string>();
  for (const page of pages) {
    if (!page?.key || keys.has(page.key) || !page.layout || !Array.isArray(page.regions)
      || !Number.isFinite(page.layout.cols) || page.layout.cols <= 0
      || !Number.isFinite(page.layout.rowHeight) || page.layout.rowHeight <= 0)
      throw new Error('TP4 模板页面配置无效');
    keys.add(page.key);
    for (const region of page.regions) {
      const bounds = region?.editor?.bounds;
      if (bounds !== undefined && (!isRecord(bounds)
        || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)
        || !Number.isFinite(bounds.w) || !Number.isFinite(bounds.h)
        || bounds.w <= 0 || bounds.h <= 0))
        throw new Error('TP4 模板区域尺寸无效');
      if (!region?.id || !region.widget?.kind || !region.grid || region.grid.colSpan <= 0 || region.grid.rowSpan <= 0
        || !['col', 'row', 'colSpan', 'rowSpan'].every(key => Number.isFinite(region.grid[key as keyof typeof region.grid])))
        throw new Error('TP4 模板区域配置无效');
    }
  }
  // 编辑专用页不能成为设备屏幕的首屏，也不能在运行时自动切入。
  document.pages = pages;
  return {
    document,
    width, height, isNew: true, nodes: [],
    background: pages[0].layout.background || document.theme.colors.canvas || '#ffffff',
  };
}

/** 纹理固定显示初始页；禁用 JS 轮播，避免慢图片改变最终截取的页面。 */
export function createSnapshotDocument(document: TP4Document): TP4Document {
  const copy = structuredClone(document);
  const pending: unknown[] = [copy];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (isRecord(value) && value.kind === 'container.swiper') value.autoplayMs = 0;
    pending.push(...Object.values(value));
  }
  return copy;
}
