import type { ApiResponse } from '@/types/ward';
import { AUTH_EXPIRED_EVENT, clearAuthSession, getSessionToken } from '@/core/auth-session';
import { getApiBaseUrl, getApiToken } from '@/utils/device-cache';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestRecord {
  path: string;
  startedAt: string;
  durationMs: number;
  status?: number;
  ok: boolean;
  error?: string;
}

const MAX_REQUEST_RECORDS = 60;
const recentApiRequests: ApiRequestRecord[] = [];

function requestPath(url: string): string {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      .pathname;
  }
  catch {
    return url.split('?')[0] || url;
  }
}

function recordApiRequest(record: ApiRequestRecord): void {
  recentApiRequests.unshift(record);
  if (recentApiRequests.length > MAX_REQUEST_RECORDS)
    recentApiRequests.length = MAX_REQUEST_RECORDS;
}

export function getRecentApiRequests(): ApiRequestRecord[] {
  return recentApiRequests.map(record => ({ ...record }));
}

export function clearRecentApiRequests(): void {
  recentApiRequests.length = 0;
}

interface PostJsonOptions {
  timeoutMs?: number;
  auth?: 'auto' | 'omit';
}

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS?.trim() || 6_000);

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\//, '');
  return `${normalizedBase}/${normalizedPath}`;
}

function buildHeaders(auth: PostJsonOptions['auth'] = 'auto'): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth !== 'omit') {
    const token = getSessionToken() || getApiToken();
    if (token)
      headers.token = token;
  }
  return headers;
}

function expireAuthentication(message: string): void {
  const hadSession = !!getSessionToken();
  clearAuthSession();
  if (hadSession && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message } }));
}

export async function postJson<T>(
  url: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let responseStatus: number | undefined;
  let requestError: string | undefined;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(options.auth),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    responseStatus = res.status;

    if (res.status === 401 || res.status === 403) {
      expireAuthentication('登录已过期，请重新登录');
      throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, res.status);
    }

    if (!res.ok)
      throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, res.status);

    const payload = await res.json() as ApiResponse<T>;
    if (payload.code === 401 || payload.code === 403) {
      expireAuthentication(payload.message || '登录已过期，请重新登录');
      throw new ApiError(payload.message || '登录已过期，请重新登录', payload.code);
    }

    return payload;
  }
  catch (error) {
    requestError = error instanceof Error ? error.message : String(error);
    if (error instanceof ApiError)
      throw error;
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new ApiError(`接口请求超时（${Math.round(timeoutMs / 1000)}秒）：${url}`);
    throw error;
  }
  finally {
    window.clearTimeout(timer);
    recordApiRequest({
      path: requestPath(url),
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      status: responseStatus,
      ok: !requestError,
      error: requestError,
    });
  }
}

export function apiUrl(path: string): string {
  return joinUrl(getApiBaseUrl(), path);
}
