import { getFileUrlPrefix } from '@/utils/file-prefix';

/** 对齐主项目：fileUrlPrefix + path */
export function resolveFileUrl(path?: string): string {
  if (!path)
    return '';

  const trimmed = path.trim();
  if (!trimmed)
    return '';

  if (/^https?:\/\//i.test(trimmed))
    return trimmed;

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const prefix = getFileUrlPrefix();

  if (prefix)
    return `${prefix}${normalizedPath}`;

  if (import.meta.env.DEV)
    return normalizedPath;

  return normalizedPath;
}
