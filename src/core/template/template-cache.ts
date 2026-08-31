import { queryTemplateById } from '@/api/template';
import { createRetryablePromiseCache } from '@/core/retryable-promise-cache';
import { parseTemplateInfo } from '@/core/template/parser';
import type { ParsedTemplate, SwpTemplateInfo } from '@/types/template';

const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;
const infoCache = createRetryablePromiseCache<number, SwpTemplateInfo>({ ttlMs: TEMPLATE_CACHE_TTL_MS });
const parsedCache = new Map<number, { signature: string; parsed: ParsedTemplate }>();

export async function loadTemplateInfo(id: number): Promise<SwpTemplateInfo> {
  return infoCache.load(id, () => queryTemplateById(id));
}

export async function loadParsedTemplate(id: number): Promise<ParsedTemplate> {
  const info = await loadTemplateInfo(id);
  const signature = `${info.analyzeType ?? ''}\u0000${info.templateContent}`;
  const cached = parsedCache.get(id);
  if (cached?.signature === signature)
    return cached.parsed;
  const parsed = parseTemplateInfo(info);
  parsedCache.set(id, { signature, parsed });
  return parsed;
}

export function clearTemplateCache() {
  infoCache.clear();
  parsedCache.clear();
}
