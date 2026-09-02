import { getEmptyBedTemplate, pickEmptyBedKey } from './door-empty-bed.ts';
import { validateTemplateContent } from './template-validation.ts';
import type { ParsedTemplate, SwpTemplateInfo, TemplateContent, TemplateNode } from '../../types/template.ts';

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
  if (id === 'sickRoomStatusCoverSlot' || id === 'sickRoomStatusCountdownSlot')
    return false;
  return true;
}

/**
 * 对齐主项目 SizeTransformStrategy：像素模板将 root 直系子节点的
 * left/top/width/height 转为百分比；子节点本身已经是父容器百分比，不重复换算。
 */
function normalizeNodeCoordinates(
  node: TemplateNode,
  tplWidth: number,
  tplHeight: number,
  analyzeType?: string,
) {
  const isPercentageTemplate = analyzeType === PERCENTAGE_TEMPLATE;
  if (isPercentageTemplate)
    return;

  const toPercentage = (value: number | string | undefined, size: number) => {
    if (value === undefined || value === null || value === '')
      return '0';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? ((numeric * 100) / size).toFixed(3) : '0';
  };

  node.left = toPercentage(node.left, tplWidth);
  node.top = toPercentage(node.top, tplHeight);
  node.width = toPercentage(node.width, tplWidth);
  node.height = toPercentage(node.height, tplHeight);
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

function cloneNode(
  input: TemplateNode,
  root: boolean,
  width: number,
  height: number,
  analyzeType?: string,
): TemplateNode {
  const node: TemplateNode = { ...input };
  if (typeof node.id === 'string')
    node.id = node.id.trim();
  if (root)
    normalizeNodeCoordinates(node, width, height, analyzeType);

  if (Array.isArray(input.children)) {
    node.children = input.children
      .filter((child): child is TemplateNode => !!child && typeof child === 'object')
      .map(child => cloneNode(child, false, width, height, analyzeType))
      .filter(shouldRenderNode);
  }
  else if (input.children && typeof input.children === 'object') {
    const childEntries = Object.entries(input.children as Record<string, TemplateNode>)
      .filter((entry): entry is [string, TemplateNode] =>
        !!entry[1] && typeof entry[1] === 'object');
    const clonedEntries = childEntries.map(([key, child]) => [
      key,
      cloneNode(child, false, width, height, analyzeType),
    ] as const);
    node.children = Object.fromEntries(
      clonedEntries.filter(([, child]) => shouldRenderNode(child)),
    );
  }
  return node;
}

export function parseTemplateContent(raw: string, analyzeType?: string): ParsedTemplate {
  let parsed: TemplateContent;
  try {
    parsed = JSON.parse(raw) as TemplateContent;
  }
  catch {
    // 部分旧的本地模板把 svgBox.children 内的引号多转义了一次，
    // 仅在标准 JSON 失败时做一次兼容修复，真实接口内容不受影响。
    try {
      parsed = JSON.parse(raw.replace(/\\\\(?=")/g, '\\')) as TemplateContent;
    }
    catch {
      throw new Error('无效的模板');
    }
  }
  const content = validateTemplateContent(parsed);
  if (content.isNew !== true)
    throw new Error('暂不支持旧模板，请检查模板配置');
  const width = content.width;
  const height = content.height;
  const nodes = (content.data ?? [])
    .filter((node): node is TemplateNode => !!node && typeof node === 'object')
    .map(node => cloneNode(node, true, width, height, analyzeType))
    .filter(shouldRenderNode);

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
