import { queryTemplateById } from '@/api/template';
import { createRetryablePromiseCache } from '@/core/retryable-promise-cache';
import { parseTemplateInfo } from '@/core/template/parser';
import type { ParsedTemplate, SwpTemplateInfo } from '@/types/template';
import { waitForFileUrlPrefix } from '@/utils/file-prefix';

export const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;
const infoCache = createRetryablePromiseCache<number, SwpTemplateInfo>({ ttlMs: TEMPLATE_CACHE_TTL_MS });
const parsedCache = new Map<number, { signature: string; parsed: ParsedTemplate }>();
let generation = 0;

export function getTemplateCacheGeneration(): number {
  return generation;
}

export async function loadTemplateInfo(id: number): Promise<SwpTemplateInfo> {
  return infoCache.load(id, () => queryTemplateById(id));
}

export async function loadParsedTemplate(id: number): Promise<ParsedTemplate> {
  const requestGeneration = generation;
  const [info] = await Promise.all([loadTemplateInfo(id), waitForFileUrlPrefix()]);
  // 手动刷新或退出登录后，旧请求不得回填新一轮缓存。
  if (requestGeneration !== generation)
    throw new Error('模板缓存已刷新，请重试');
  const signature = JSON.stringify([info.analyzeType, info.systemType, info.templateType, info.templateContent]);
  const cached = parsedCache.get(id);
  if (cached?.signature === signature)
    return cached.parsed;
  const parsed = parseTemplateInfo(info);
  parsedCache.set(id, { signature, parsed });
  return parsed;
}

export function clearTemplateCache() {
  generation++;
  infoCache.clear();
  parsedCache.clear();
}
