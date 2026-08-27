import { getEmptyBedTemplate, pickEmptyBedKey } from '@/core/template/door-empty-bed';
import { validateTemplateContent } from '@/core/template/template-validation';
import type { ParsedTemplate, SwpTemplateInfo, TemplateContent, TemplateNode } from '@/types/template';

/** 对齐主项目 AnalyzeTypeEnum.PERCENTAGE_TEMPLATE */
const PERCENTAGE_TEMPLATE = '2';

function toNumber(value: number | string | undefined, fallback = 0): number {
  if (value === undefined || value === null || value === '')
    return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function shouldRenderNode(node: TemplateNode): boolean {
  if (node.isRender === 'false' || node.isRender === false)
    return false;
  const id = node.id ?? '';
  if (/^button\d*$/i.test(id))
    return false;
  if (node.class === 'button')
    return false;
  if (id === 'sickRoomStatusCoverSlot' || id === 'sickRoomStatusCountdownSlot')
    return false;
  return true;
}

/**
 * 对齐主项目 SizeTransformStrategy：像素模板将 left/top/width/height 转为百分比
 * 仅处理 root 直系子节点（模板 data 数组中的扁平节点）
 */
function normalizeNodeCoordinates(
  nodes: TemplateNode[],
  tplWidth: number,
  tplHeight: number,
  analyzeType?: string,
  isNew?: boolean,
) {
  const isPercentageTemplate = analyzeType === PERCENTAGE_TEMPLATE;
  if (isPercentageTemplate)
    return;

  const shouldConvert = isNew || analyzeType === '1' || !analyzeType;
  if (!shouldConvert)
    return;

  for (const node of nodes) {
    if (node.left !== undefined && node.left !== '')
      node.left = ((+node.left * 100) / tplWidth).toFixed(3);
    if (node.top !== undefined && node.top !== '')
      node.top = ((+node.top * 100) / tplHeight).toFixed(3);
    if (node.width !== undefined && node.width !== '')
      node.width = ((+node.width * 100) / tplWidth).toFixed(3);
    if (node.height !== undefined && node.height !== '')
      node.height = ((+node.height * 100) / tplHeight).toFixed(3);
  }
}

/** 对齐主项目 ParentObjectTransformStrategy：为 doorInfoBox 注入空床模板 */
function injectDoorEmptyBedTemplates(nodes: TemplateNode[]) {
  for (const node of nodes) {
    if (node.id !== 'doorInfoBox' || !node.children || Array.isArray(node.children))
      continue;
    const children = node.children as Record<string, TemplateNode>;
    (['bed1', 'bed2', 'bed3'] as const).forEach((key) => {
      const emptyKey = pickEmptyBedKey(key);
      if (!children[emptyKey])
        children[emptyKey] = getEmptyBedTemplate(key);
    });
  }
}

export function parseTemplateContent(raw: string, analyzeType?: string): ParsedTemplate {
  const content = validateTemplateContent(JSON.parse(raw) as TemplateContent);
  const width = content.width;
  const height = content.height;
  const nodes = (content.data ?? [])
    .map(node => ({ ...node }))
    .filter(shouldRenderNode);

  normalizeNodeCoordinates(nodes, width, height, analyzeType, content.isNew);
  injectDoorEmptyBedTemplates(nodes);

  nodes.sort((a, b) => {
    const za = toNumber(a.zIndex);
    const zb = toNumber(b.zIndex);
    return za !== zb ? za - zb : 0;
  });

  return {
    width,
    height,
    isNew: !!content.isNew,
    analyzeType,
    background: content.background ?? '#ffffff',
    nodes,
  };
}

export function parseTemplateInfo(info: SwpTemplateInfo): ParsedTemplate {
  const analyzeType = info.analyzeType != null ? String(info.analyzeType) : undefined;
  return parseTemplateContent(info.templateContent, analyzeType);
}
