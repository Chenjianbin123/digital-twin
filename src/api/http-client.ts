import type { ApiResponse } from '@/types/ward';
import { assertRemoteRequestsAllowed } from '@/core/data-source';
import { AUTH_EXPIRED_EVENT, clearAuthSession, getSessionToken } from '@/core/auth-session';
import { getApiBaseUrl, getApiToken } from '@/utils/device-cache';
import { ApiError, httpFailureKind, normalizeApiFailure } from '@/core/api-failure';
import { safeApiPath, sanitizeApiRecord, type SafeApiRequestRecord } from '@/core/api-diagnostics';

export { ApiError } from '@/core/api-failure';

export interface ApiRequestRecord extends SafeApiRequestRecord {}

const MAX_REQUEST_RECORDS = 60;
const recentApiRequests: ApiRequestRecord[] = [];

function recordApiRequest(record: ApiRequestRecord): void {
  recentApiRequests.unshift(sanitizeApiRecord(record));
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

function expireAuthentication(message: string, requestToken?: string): void {
  // A background response from the previous login must not expire the current session.
  if (!requestToken || requestToken !== getSessionToken()) return;
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
  assertRemoteRequestsAllowed();
  const controller = new AbortController();
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? requestedTimeout : 6_000;
  const startedAt = Date.now();
  let responseStatus: number | undefined;
  let requestError: ApiError | undefined;
  let businessCode: number | undefined;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = buildHeaders(options.auth);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    responseStatus = res.status;

    if (res.status === 401 || res.status === 403) {
      expireAuthentication('登录已过期，请重新登录', headers.token);
      throw new ApiError(httpFailureKind(res.status), res.status);
    }

    if (!res.ok)
      throw new ApiError(httpFailureKind(res.status), res.status);

    let payload: ApiResponse<T>;
    try { payload = await res.json() as ApiResponse<T>; }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ApiError('invalid-response');
    }
    if (!payload || typeof payload !== 'object' || !Number.isSafeInteger(payload.code))
      throw new ApiError('invalid-response');
    businessCode = payload.code;
    if (payload.code === 401 || payload.code === 403) {
      expireAuthentication('登录已失效或访问受限，请重新登录', headers.token);
      throw new ApiError(httpFailureKind(payload.code), undefined, payload.code);
    }
    if (payload.code !== 200) throw new ApiError('business', undefined, payload.code);

    return payload;
  }
  catch (error) {
    requestError = normalizeApiFailure(error);
    throw requestError;
  }
  finally {
    window.clearTimeout(timer);
    recordApiRequest({
      path: safeApiPath(url),
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      status: responseStatus,
      ok: !requestError,
      businessCode,
      kind: requestError?.kind,
      error: requestError?.message,
    });
  }
}

export function apiUrl(path: string): string {
  return joinUrl(getApiBaseUrl(), path);
}
