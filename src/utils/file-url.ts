import { getFileUrlPrefix, isFileUrlPrefixLoading } from '@/utils/file-prefix';
import { resolveLocalAsset } from '@/core/local-asset';
import { resolveDataSource } from '@/core/data-source';

/** 对齐主项目：fileUrlPrefix + path */
export function resolveFileUrl(path?: string): string {
  if (resolveDataSource() === 'mock') return resolveLocalAsset(path);
  if (!path)
    return '';

  const trimmed = path.trim();
  if (!trimmed)
    return '';

  if (/^https?:\/\//i.test(trimmed))
    return trimmed;

  // Reactive consumers retry when initialization finishes instead of requesting a wrong origin.
  if (isFileUrlPrefixLoading()) return '';

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const prefix = getFileUrlPrefix();

  if (prefix)
    return `${prefix}${normalizedPath}`;

  if (import.meta.env.DEV)
    return normalizedPath;

  return normalizedPath;
}
