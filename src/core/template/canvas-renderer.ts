import type { BedTemplateData } from './data-mapper.ts';
import { buildBedTemplateData, resolveNodeText, resolveNursingBackground } from './data-mapper.ts';
import type { ParsedTemplate, TemplateNode } from '../../types/template.ts';
import { drawTemplateImagePlaceholder } from './template-display-state.ts';
import type { TwinBedEntity } from '../../types/twin.ts';
import type { NursingLabelItem } from '../../types/ward.ts';
import { getFileUrlPrefix } from '../../utils/file-prefix.ts';

export interface RenderOptions {
  outputWidth?: number;
  outputHeight?: number;
}

const DEFAULT_WIDTH = 512;

function toNumber(value: number | string | undefined, fallback = 0): number {
  if (value === undefined || value === null || value === '')
    return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 对齐主项目 rem.ts：1024 横屏 root=30px，1280=37.5，1920=54 */
function getTemplateRemBase(templateWidth: number): number {
  if (templateWidth >= 1920)
    return 54;
  if (templateWidth >= 1280)
    return 37.5;
  return 30;
}

function parseRem(value: string | number | undefined, remPx: number): number {
  if (value === undefined || value === '')
    return 0;
  const str = String(value).trim();
  if (str === 'auto')
    return remPx;
  if (str.endsWith('rem'))
    return parseFloat(str) * remPx;
  if (str.endsWith('px'))
    return parseFloat(str);
  const n = parseFloat(str);
  return Number.isFinite(n) ? n * remPx : remPx;
}

function parseBorderRadius(value: string | undefined, remPx: number): number {
  if (!value)
    return 0;
  const parts = value.split(/\s+/).map(v => parseRem(v, remPx));
  return Math.max(...parts, 0);
}

function resolveImageUrl(src?: string): string | null {
  if (!src || !src.trim())
    return null;
  const trimmed = src.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:'))
    return trimmed;
  if (trimmed.startsWith('../'))
    return null;
  const prefix = getFileUrlPrefix();
  if (!prefix)
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${prefix}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 解析后节点坐标均为百分比（对齐主项目 SizeTransformStrategy） */
function getNodeRect(node: TemplateNode, outW: number, outH: number): LayoutRect {
  return {
    x: (toNumber(node.left) / 100) * outW,
    y: (toNumber(node.top) / 100) * outH,
    w: (toNumber(node.width) / 100) * outW,
    h: (toNumber(node.height) / 100) * outH,
  };
}

/** ParserV3 子节点的尺寸相对父容器百分比。 */
function getChildRect(node: TemplateNode, parent: LayoutRect): LayoutRect {
  const width = toNumber(node.width);
  const height = toNumber(node.height);
  return {
    x: parent.x + (toNumber(node.left) / 100) * parent.w,
    y: parent.y + (toNumber(node.top) / 100) * parent.h,
    w: width > 0 ? (width / 100) * parent.w : parent.w,
    h: height > 0 ? (height / 100) * parent.h : parent.h,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getFontWeight(weight: number | string | undefined): string {
  if (!weight)
    return 'normal';
  const n = Number(weight);
  if (Number.isFinite(n) && n >= 100)
    return String(n);
  return String(weight);
}

function drawNodeBackground(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  remPx: number,
  nursingBg?: string | null,
) {
  const bg = nursingBg ?? (node.background as string | undefined);
  if (!bg || bg === 'rgba(255, 255, 255, 0)' || bg === 'transparent')
    return;

  const radius = parseBorderRadius(node.borderRadius, remPx);
  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  ctx.fillStyle = bg;
  if (radius > 0)
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  else
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.fill();
  ctx.restore();
}

function drawNodeText(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  text: string,
  remPx: number,
) {
  if (!text)
    return;

  const fontSize = Math.max(10, parseRem(node.fontSize, remPx) || remPx * 0.75);
  const weight = getFontWeight(node.fontWeight);
  const align = (node.textAlign as string)
    || (node.justifyContent === 'center' ? 'center' : 'left');
  const valign = (node.alignItems as string) || 'center';

  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  ctx.fillStyle = (node.color as string) || '#333333';
  ctx.font = `${weight} ${fontSize}px "Microsoft YaHei", "Source Han Sans CN", sans-serif`;
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  let x = rect.x + 4;
  let y = rect.y + rect.h / 2;

  if (align === 'center')
    x = rect.x + (rect.w - metrics.width) / 2;
  else if (align === 'right' || align === 'end')
    x = rect.x + rect.w - metrics.width - 4;

  if (valign === 'flex-start' || valign === 'start' || valign === 'top')
    y = rect.y + fontSize * 0.6;
  else if (valign === 'flex-end' || valign === 'end' || valign === 'bottom')
    y = rect.y + rect.h - fontSize * 0.4;

  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCareLabels(
  ctx: CanvasRenderingContext2D,
  rect: LayoutRect,
  labels: NursingLabelItem[],
  remPx: number,
) {
  if (!labels.length)
    return;
  const gap = 6;
  const rowH = Math.min(rect.h / 3, remPx * 1.4);
  let x = rect.x + 4;
  let y = rect.y + 4;
  const maxX = rect.x + rect.w - 4;

  for (const label of labels) {
    const text = label.labelName || '';
    ctx.font = `500 ${Math.max(10, remPx * 0.65)}px "Microsoft YaHei", sans-serif`;
    const textW = ctx.measureText(text).width + 16;
    if (x + textW > maxX) {
      x = rect.x + 4;
      y += rowH + gap;
      if (y + rowH > rect.y + rect.h)
        break;
    }
    ctx.fillStyle = label.labelColor || '#456BAF';
    drawRoundedRect(ctx, x, y, textW, rowH, 4);
    ctx.fill();
    ctx.fillStyle = label.labelTextColor || '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 8, y + rowH / 2);
    x += textW + gap;
  }
}

function drawLine(ctx: CanvasRenderingContext2D, node: TemplateNode, rect: LayoutRect) {
  const bg = (node.background as string) || (node.borderColor as string) || '#333333';
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, Math.max(1, rect.w), Math.max(1, rect.h));
  ctx.restore();
}

async function drawNodeImage(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  imageMap: Map<string, HTMLImageElement>,
): Promise<boolean> {
  const url = resolveImageUrl(node.src);
  if (!url)
    return false;
  let img = imageMap.get(url);
  if (!img) {
    img = await loadImage(url) ?? undefined;
    if (img)
      imageMap.set(url, img);
  }
  if (!img)
    drawTemplateImagePlaceholder(ctx, rect, String(node.text || node.title || ''));
  if (!img)
    return false;
  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  const objectFit = String(node.objectFit ?? 'fill');
  if (objectFit === 'contain') {
    const scale = Math.min(rect.w / img.width, rect.h / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    ctx.drawImage(
      img,
      rect.x + (rect.w - width) / 2,
      rect.y + (rect.h - height) / 2,
      width,
      height,
    );
  }
  else {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
  return true;
}

async function drawQrCodeNode(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  imageMap: Map<string, HTMLImageElement>,
  value: string,
) {
  const rendered = await drawNodeImage(ctx, node, rect, imageMap);
  if (!rendered)
    drawPseudoQrCode(ctx, rect, value);
}

function getNodeType(node: TemplateNode): string {
  return node.type ?? node.title ?? 'element';
}

function isInteractiveBedNode(node: TemplateNode): boolean {
  return getNodeType(node) === 'svgBox'
    || /^button\d*$/i.test(String(node.id ?? ''))
    || node.class === 'button';
}

function getTemplateChildren(node: TemplateNode): TemplateNode[] {
  if (Array.isArray(node.children))
    return node.children.filter((child): child is TemplateNode => !!child && typeof child === 'object');
  if (node.children && typeof node.children === 'object') {
    return Object.values(node.children as Record<string, TemplateNode>)
      .filter((child): child is TemplateNode => !!child && typeof child === 'object');
  }
  return [];
}

function collectTemplateImageUrls(
  nodes: TemplateNode[],
  urls: Set<string>,
) {
  for (const node of nodes) {
    const type = getNodeType(node);
    if (type === 'img' || type === 'svgBox') {
      const url = resolveImageUrl(node.src);
      if (url)
        urls.add(url);
    }
    collectTemplateImageUrls(getTemplateChildren(node), urls);
  }
}

function drawPseudoQrCode(
  ctx: CanvasRenderingContext2D,
  rect: LayoutRect,
  value: string,
) {
  const side = Math.min(rect.w, rect.h);
  if (side < 12)
    return;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = '#c6d0d8';
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1));

  if (!value) {
    ctx.restore();
    return;
  }

  const modules = 21;
  const moduleSize = side / modules;
  let seed = 0;
  for (const char of value)
    seed = ((seed << 5) - seed + char.charCodeAt(0)) | 0;
  const bit = (x: number, y: number) => {
    const mixed = Math.imul((x + 1) * 73856093, (y + 1) * 19349663) ^ seed;
    return (mixed & 1) === 1;
  };
  const drawFinder = (x: number, y: number) => {
    ctx.fillStyle = '#101820';
    ctx.fillRect(rect.x + x * moduleSize, rect.y + y * moduleSize, 7 * moduleSize, 7 * moduleSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rect.x + (x + 1) * moduleSize, rect.y + (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = '#101820';
    ctx.fillRect(rect.x + (x + 2) * moduleSize, rect.y + (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
  };
  drawFinder(0, 0);
  drawFinder(modules - 7, 0);
  drawFinder(0, modules - 7);
  ctx.fillStyle = '#101820';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      const inFinder = (x < 8 && y < 8)
        || (x >= modules - 8 && y < 8)
        || (x < 8 && y >= modules - 8);
      if (!inFinder && bit(x, y))
        ctx.fillRect(rect.x + x * moduleSize, rect.y + y * moduleSize, moduleSize + 0.2, moduleSize + 0.2);
    }
  }
  ctx.restore();
}

async function renderTemplateNodes(
  ctx2d: CanvasRenderingContext2D,
  nodes: TemplateNode[],
  parentRect: LayoutRect | undefined,
  outW: number,
  outH: number,
  remPx: number,
  imageMap: Map<string, HTMLImageElement>,
  renderContext: TemplateRenderContext,
) {
  for (const node of [...nodes].sort((a, b) => toNumber(a.zIndex) - toNumber(b.zIndex))) {
    if (node.isRender === false || node.isRender === 'false' || node.display === 'none')
      continue;
    if (isInteractiveBedNode(node))
      continue;
    const rect = parentRect ? getChildRect(node, parentRect) : getNodeRect(node, outW, outH);
    if (rect.w <= 0 || rect.h <= 0)
      continue;

    const type = getNodeType(node);
    const nursingBg = renderContext.resolveNursingBackground?.(node.id);
    if (node.id === 'qrcode') {
      drawNodeBackground(ctx2d, node, rect, remPx, nursingBg);
      await drawQrCodeNode(ctx2d, node, rect, imageMap, renderContext.resolveText(node));
    }
    else if (type === 'img') {
      await drawNodeImage(ctx2d, node, rect, imageMap);
    }
    else if (node.id === 'careLabelBox' || type === 'careLabel') {
      drawCareLabels(ctx2d, rect, renderContext.careLabels ?? [], remPx);
    }
    else if (type === 'verticalLine' || type === 'transverseLine') {
      drawLine(ctx2d, node, rect);
    }
    else {
      drawNodeBackground(ctx2d, node, rect, remPx, nursingBg);
      const text = renderContext.resolveText(node);
      if (text)
        drawNodeText(ctx2d, node, rect, text, remPx);
    }

    const children = getTemplateChildren(node);
    if (children.length)
      await renderTemplateNodes(ctx2d, children, rect, outW, outH, remPx, imageMap, renderContext);
  }
}

export interface TemplateRenderContext {
  resolveText: (node: TemplateNode) => string;
  resolveNursingBackground?: (nodeId?: string) => string | null;
  careLabels?: NursingLabelItem[];
  callingBadge?: boolean;
}

export async function renderTemplateWithContext(
  template: ParsedTemplate,
  ctx: TemplateRenderContext,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const outW = options.outputWidth ?? DEFAULT_WIDTH;
  const outH = options.outputHeight ?? Math.round(outW * (template.height / template.width));
  const scale = outW / template.width;
  const remPx = getTemplateRemBase(template.width) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const c2d = canvas.getContext('2d')!;
  c2d.fillStyle = template.background;
  c2d.fillRect(0, 0, outW, outH);

  const imageUrls = new Set<string>();
  collectTemplateImageUrls(template.nodes, imageUrls);
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all([...imageUrls].map(async (url) => {
    const img = await loadImage(url);
    if (img)
      imageMap.set(url, img);
  }));

  await renderTemplateNodes(c2d, template.nodes, undefined, outW, outH, remPx, imageMap, ctx);

  if (ctx.callingBadge) {
    const badgeW = 90;
    const badgeH = 28;
    c2d.fillStyle = 'rgba(233, 30, 99, 0.9)';
    drawRoundedRect(c2d, outW - badgeW - 8, 8, badgeW, badgeH, 6);
    c2d.fill();
    c2d.fillStyle = '#ffffff';
    c2d.font = 'bold 14px sans-serif';
    c2d.textBaseline = 'middle';
    c2d.fillText('呼叫中', outW - badgeW + 14, 8 + badgeH / 2);
  }

  return canvas;
}

export async function renderTemplateToCanvas(
  bed: TwinBedEntity,
  template: ParsedTemplate,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const data: BedTemplateData = buildBedTemplateData(bed);
  return renderTemplateWithContext(template, {
    resolveText: node => resolveNodeText(node, data),
    resolveNursingBackground: nodeId => resolveNursingBackground(bed, nodeId),
    careLabels: data.bedSickNursingLabelList,
    callingBadge: !!bed.isCalling,
  }, options);
}
