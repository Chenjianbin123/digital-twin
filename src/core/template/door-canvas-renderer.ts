import {
  getEmptyBedTemplate,
  pickBedLayoutKey,
  pickEmptyBedKey,
} from '@/core/template/door-empty-bed';
import type { DoorTemplateData } from '@/core/template/door-data-mapper';
import {
  resolveDoorNodeText,
  resolveDoorNursingBackground,
} from '@/core/template/door-data-mapper';
import type { RenderOptions } from '@/core/template/canvas-renderer';
import {
  getDoorTemplateRemBase,
  isDoorHorizontal,
  resolveDoorDirector,
} from '@/core/template/door-screen-orientation';
import type { ParsedTemplate, TemplateNode } from '@/types/template';
import { drawTemplateImagePlaceholder } from '@/core/template/template-display-state';
import type { TwinWardEntity } from '@/types/twin';
import { getFileUrlPrefix } from '@/utils/file-prefix';

const DEFAULT_WIDTH = 960;

function toNumber(value: number | string | undefined, fallback = 0): number {
  if (value === undefined || value === null || value === '')
    return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 根节点：百分比相对画布 */
function getNodeRect(node: TemplateNode, outW: number, outH: number): LayoutRect {
  return {
    x: (toNumber(node.left) / 100) * outW,
    y: (toNumber(node.top) / 100) * outH,
    w: (toNumber(node.width) / 100) * outW,
    h: (toNumber(node.height) / 100) * outH,
  };
}

/** 子节点：百分比相对父容器 */
function getChildRect(node: TemplateNode, parent: LayoutRect): LayoutRect {
  const w = (toNumber(node.width) / 100) * parent.w;
  const h = (toNumber(node.height) / 100) * parent.h;
  return {
    x: parent.x + (toNumber(node.left) / 100) * parent.w,
    y: parent.y + (toNumber(node.top) / 100) * parent.h,
    w: w || parent.w,
    h: h || parent.h,
  };
}

function sortByZIndex(nodes: TemplateNode[]): TemplateNode[] {
  return [...nodes].sort((a, b) => toNumber(a.zIndex) - toNumber(b.zIndex));
}

function shouldSkipNode(node: TemplateNode): boolean {
  const id = node.id ?? '';
  if (/^button\d*$/i.test(id))
    return true;
  if (node.class === 'button')
    return true;
  if (id === 'sickRoomStatusCoverSlot' || id === 'sickRoomStatusCountdownSlot')
    return true;
  return false;
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

function getNodeType(node: TemplateNode): string {
  return node.type ?? node.title ?? 'element';
}

function getFontWeight(weight: number | string | undefined): string {
  if (!weight)
    return 'normal';
  const n = Number(weight);
  if (Number.isFinite(n) && n >= 100)
    return String(n);
  return String(weight);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  fontSize: number,
  weight: string,
  minSize = 8,
): { text: string; fontSize: number } {
  let size = fontSize;
  const family = '"Microsoft YaHei", "Source Han Sans CN", sans-serif';
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW - 4)
      return { text, fontSize: size };
    size -= 0.5;
  }
  let trimmed = text;
  ctx.font = `${weight} ${minSize}px ${family}`;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxW - 4)
    trimmed = trimmed.slice(0, -1);
  return { text: trimmed.length < text.length ? `${trimmed}…` : trimmed, fontSize: minSize };
}

function drawNodeBackground(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  remPx: number,
  bg?: string | null,
) {
  const fill = bg ?? (node.background as string | undefined);
  if (!fill || fill === 'rgba(255, 255, 255, 0)' || fill === 'transparent')
    return;
  const radius = parseBorderRadius(node.borderRadius, remPx);
  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  ctx.fillStyle = fill;
  if (radius > 0) {
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.fill();
  }
  else {
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
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
  const baseSize = parseRem(node.fontSize, remPx) || remPx * 0.75;
  const weight = getFontWeight(node.fontWeight);
  const align = (node.textAlign as string)
    || (node.justifyContent === 'center' ? 'center' : 'left');
  const valign = (node.alignItems as string) || 'center';

  const { text: fitted, fontSize } = fitText(ctx, text, rect.w, Math.max(9, baseSize), weight);

  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  ctx.fillStyle = (node.color as string) || '#333333';
  ctx.font = `${weight} ${fontSize}px "Microsoft YaHei", "Source Han Sans CN", sans-serif`;
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(fitted);
  let x = rect.x + 4;
  let y = rect.y + rect.h / 2;
  if (align === 'center')
    x = rect.x + (rect.w - metrics.width) / 2;
  else if (align === 'right' || align === 'end')
    x = rect.x + rect.w - metrics.width - 4;
  if (valign === 'flex-start' || valign === 'start' || valign === 'top')
    y = rect.y + fontSize * 0.65;
  else if (valign === 'flex-end' || valign === 'end' || valign === 'bottom')
    y = rect.y + rect.h - fontSize * 0.35;

  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillText(fitted, x, y);
  ctx.restore();
}

function isEnvImageNode(id?: string): boolean {
  return !!id?.startsWith('doorEnvInfo-') && id.endsWith('-img');
}

async function drawNodeImage(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  imageMap: Map<string, HTMLImageElement>,
) {
  const url = resolveImageUrl(node.src);
  if (!url)
    return;
  let img = imageMap.get(url);
  if (!img) {
    img = await loadImage(url) ?? undefined;
    if (img)
      imageMap.set(url, img);
  }
  if (!img)
    return drawTemplateImagePlaceholder(ctx, rect, String(node.text || node.title || ''));

  ctx.save();
  ctx.globalAlpha = toNumber(node.opacity, 1) || 1;
  const fit = (node.objectFit as string) || 'fill';
  if (fit === 'contain') {
    const scale = Math.min(rect.w / img.width, rect.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh);
  }
  else {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

async function renderBedSlotChildren(
  ctx: CanvasRenderingContext2D,
  slotTpl: TemplateNode,
  data: DoorTemplateData,
  bedIndex: number,
  slotRect: LayoutRect,
  remPx: number,
  imageMap: Map<string, HTMLImageElement>,
) {
  const children = Array.isArray(slotTpl.children) ? slotTpl.children : [];
  for (const child of sortByZIndex(children)) {
    if (shouldSkipNode(child))
      continue;
    const rect = getChildRect(child, slotRect);
    if (rect.w <= 0 || rect.h <= 0)
      continue;

    const type = getNodeType(child);
    if (type === 'img') {
      await drawNodeImage(ctx, child, rect, imageMap);
      continue;
    }

    const nursingBg = resolveDoorNursingBackground(child, data, bedIndex);
    drawNodeBackground(ctx, child, rect, remPx, nursingBg);
    const text = resolveDoorNodeText(child, data, bedIndex);
    if (text)
      drawNodeText(ctx, child, rect, text, remPx);
  }
}

async function renderBedSlot(
  ctx: CanvasRenderingContext2D,
  slotTpl: TemplateNode,
  data: DoorTemplateData,
  bedIndex: number,
  slotRect: LayoutRect,
  remPx: number,
  imageMap: Map<string, HTMLImageElement>,
) {
  drawNodeBackground(ctx, slotTpl, slotRect, remPx, slotTpl.background as string);
  await renderBedSlotChildren(ctx, slotTpl, data, bedIndex, slotRect, remPx, imageMap);
}

interface BedSlotLayout {
  rect: LayoutRect;
  index: number;
}

function buildBedSlotLayouts(
  rect: LayoutRect,
  bedCount: number,
  layoutKey: 'bed1' | 'bed2' | 'bed3',
  occupiedTpl: TemplateNode,
): BedSlotLayout[] {
  const gap = layoutKey === 'bed3' ? 3 : 4;
  const slots: BedSlotLayout[] = [];

  if (layoutKey === 'bed3') {
    const cols = 2;
    const cellWPct = toNumber(occupiedTpl.width) || 48;
    const cellHPct = toNumber(occupiedTpl.height) || 30;
    const cellW = (rect.w * cellWPct / 100);
    const cellH = (rect.h * cellHPct / 100);
    const colGap = (rect.w - cellW * cols) / (cols + 1);

    for (let i = 0; i < bedCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      slots.push({
        index: i,
        rect: {
          x: rect.x + colGap + col * (cellW + colGap),
          y: rect.y + row * (cellH + gap),
          w: cellW,
          h: cellH,
        },
      });
    }
    return slots;
  }

  const slotHPct = toNumber(occupiedTpl.height) || (layoutKey === 'bed2' ? 22 : 30.5);
  const slotH = rect.h * slotHPct / 100;
  for (let i = 0; i < bedCount; i++) {
    slots.push({
      index: i,
      rect: {
        x: rect.x,
        y: rect.y + i * (slotH + gap),
        w: rect.w,
        h: slotH,
      },
    });
  }
  return slots;
}

function resolveEmptyBedTpl(
  children: Record<string, TemplateNode>,
  layoutKey: 'bed1' | 'bed2' | 'bed3',
): TemplateNode {
  const emptyKey = pickEmptyBedKey(layoutKey);
  return children[emptyKey] ?? getEmptyBedTemplate(layoutKey);
}

async function renderDoorInfoBox(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  rect: LayoutRect,
  data: DoorTemplateData,
  remPx: number,
  imageMap: Map<string, HTMLImageElement>,
) {
  const children = node.children;
  if (!children || Array.isArray(children))
    return;

  const childMap = children as Record<string, TemplateNode>;
  const layoutKey = pickBedLayoutKey(data.bedDeviceList.length);
  const occupiedTpl = childMap[layoutKey];
  if (!occupiedTpl)
    return;

  const beds = data.bedDeviceList;
  const slotLayouts = buildBedSlotLayouts(rect, beds.length, layoutKey, occupiedTpl);

  for (const { index, rect: slotRect } of slotLayouts) {
    const hasSick = !!beds[index].sickInfo?.sickNo;
    const tpl = hasSick ? occupiedTpl : resolveEmptyBedTpl(childMap, layoutKey);
    await renderBedSlot(ctx, tpl, data, index, slotRect, remPx, imageMap);
  }
}

async function renderNode(
  ctx: CanvasRenderingContext2D,
  node: TemplateNode,
  data: DoorTemplateData,
  outW: number,
  outH: number,
  remPx: number,
  imageMap: Map<string, HTMLImageElement>,
) {
  if (shouldSkipNode(node))
    return;

  const rect = getNodeRect(node, outW, outH);
  if (rect.w <= 0 || rect.h <= 0)
    return;

  const type = getNodeType(node);
  const id = node.id ?? '';

  if (id === 'doorInfoBox' || (type === 'parentObject' && id === 'doorInfoBox')) {
    await renderDoorInfoBox(ctx, node, rect, data, remPx, imageMap);
    return;
  }

  if (isEnvImageNode(id)) {
    const hasEnv = data.doorEnvData.temp || data.doorEnvData.relativeHumid || data.doorEnvData.airQuality;
    if (hasEnv)
      await drawNodeImage(ctx, node, rect, imageMap);
    return;
  }

  if (type === 'img' || type === 'svgBox') {
    if (type === 'svgBox')
      return;
    await drawNodeImage(ctx, node, rect, imageMap);
    return;
  }

  if (type === 'text') {
    drawNodeText(ctx, node, rect, resolveDoorNodeText(node, data), remPx);
    return;
  }

  if (type === 'verticalLine' || type === 'transverseLine') {
    const bg = (node.background as string) || (node.borderColor as string) || '#333333';
    ctx.fillStyle = bg;
    ctx.fillRect(rect.x, rect.y, Math.max(1, rect.w), Math.max(1, rect.h));
    return;
  }

  drawNodeBackground(ctx, node, rect, remPx);
  const text = resolveDoorNodeText(node, data);
  if (text) {
    let color = (node.color as string) || '#333333';
    if (id === 'doorEnvInfo-airQuality' && text === '优')
      color = '#2e7d32';
    drawNodeText(ctx, { ...node, color }, rect, text, remPx);
  }
}

function collectImageUrls(nodes: TemplateNode[], urls: Set<string>) {
  for (const node of nodes) {
    if (shouldSkipNode(node))
      continue;
    if (getNodeType(node) === 'img' && !isEnvImageNode(node.id)) {
      const url = resolveImageUrl(node.src);
      if (url)
        urls.add(url);
    }
    if (node.id === 'doorInfoBox' && node.children && !Array.isArray(node.children)) {
      for (const bedTpl of Object.values(node.children as Record<string, TemplateNode>)) {
        const kids = Array.isArray(bedTpl.children) ? bedTpl.children : [];
        for (const child of kids) {
          if (getNodeType(child) === 'img') {
            const url = resolveImageUrl(child.src);
            if (url)
              urls.add(url);
          }
        }
      }
    }
  }
}

export interface DoorRenderOptions extends RenderOptions {
  room?: TwinWardEntity;
  /** 对齐主项目 windowMode，未传时由 room.director / 模板宽高推断 */
  isHorizontal?: boolean;
}

export async function renderDoorTemplateToCanvas(
  data: DoorTemplateData,
  template: ParsedTemplate,
  options: DoorRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const director = resolveDoorDirector(options.room, template);
  const horizontal = options.isHorizontal ?? isDoorHorizontal(director);
  const outW = options.outputWidth ?? DEFAULT_WIDTH;
  const outH = options.outputHeight ?? Math.round(outW * (template.height / template.width));
  const scale = outW / template.width;
  const remPx = getDoorTemplateRemBase(template, horizontal) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = template.background;
  ctx.fillRect(0, 0, outW, outH);

  const imageUrls = new Set<string>();
  collectImageUrls(template.nodes, imageUrls);

  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all([...imageUrls].map(async (url) => {
    const img = await loadImage(url);
    if (img)
      imageMap.set(url, img);
  }));

  const sortedNodes = sortByZIndex(template.nodes);
  for (const node of sortedNodes)
    await renderNode(ctx, node, data, outW, outH, remPx, imageMap);

  return canvas;
}
