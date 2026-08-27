import type { AuthRole, AuthSession, AuthUser, PendingAuth } from '@/types/auth';

export const AUTH_TOKEN_KEY = 'TokenKey';
export const AUTH_USER_KEY = 'DIGITAL_TWIN_AUTH_USER';
export const AUTH_ROLE_KEY = 'DIGITAL_TWIN_AUTH_ROLE';
export const AUTH_EXPIRED_EVENT = 'digital-twin:auth-expired';

function resolveStorage(storage?: Storage): Storage | null {
  if (storage)
    return storage;
  if (typeof window === 'undefined')
    return null;
  return window.sessionStorage;
}

function parseObject<T>(value: string | null): T | null {
  if (!value)
    return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as T : null;
  }
  catch {
    return null;
  }
}

export function getSessionToken(storage?: Storage): string {
  return resolveStorage(storage)?.getItem(AUTH_TOKEN_KEY)?.trim() ?? '';
}

export function readPendingAuth(storage?: Storage): PendingAuth | null {
  const target = resolveStorage(storage);
  if (!target)
    return null;

  const token = getSessionToken(target);
  const user = parseObject<AuthUser>(target.getItem(AUTH_USER_KEY));
  if (!token || !user || !Array.isArray(user.roleList))
    return null;

  return { token, user };
}

export function readAuthSession(storage?: Storage): AuthSession | null {
  const target = resolveStorage(storage);
  const pending = readPendingAuth(target ?? undefined);
  const role = target ? parseObject<AuthRole>(target.getItem(AUTH_ROLE_KEY)) : null;
  if (!pending || !role || role.id == null || !role.roleName)
    return null;

  return { ...pending, role };
}

export function writePendingAuth(user: AuthUser, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target)
    return;

  target.setItem(AUTH_TOKEN_KEY, user.token);
  target.setItem(AUTH_USER_KEY, JSON.stringify(user));
  target.removeItem(AUTH_ROLE_KEY);
}

export function replacePendingAuthToken(token: string, storage?: Storage): void {
  const target = resolveStorage(storage);
  const user = target ? parseObject<AuthUser>(target.getItem(AUTH_USER_KEY)) : null;
  const normalizedToken = token.trim();
  if (!target || !user || !normalizedToken)
    return;

  user.token = normalizedToken;
  target.setItem(AUTH_TOKEN_KEY, normalizedToken);
  target.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function confirmAuthRole(role: AuthRole, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target || !readPendingAuth(target))
    return;
  target.setItem(AUTH_ROLE_KEY, JSON.stringify(role));
}

export function clearAuthSession(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target)
    return;
  target.removeItem(AUTH_TOKEN_KEY);
  target.removeItem(AUTH_USER_KEY);
  target.removeItem(AUTH_ROLE_KEY);
}
