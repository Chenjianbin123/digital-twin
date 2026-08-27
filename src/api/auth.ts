import md5 from 'js-md5';
import { getDataSource } from '@/api/door-device';
import { apiUrl, postJson } from '@/api/http-client';
import type { AuthUser } from '@/types/auth';

const LOGIN_PATH = 'system/sysUser/login';
const ROLE_CONFIRM_PATH = 'system/sysUser/roleConfirm';
const DEFAULT_DATABASE_AUTH_BASE = '/db-adapter';

interface DatabaseAuthResponse<T> {
  data?: T;
  error?: string;
}

export interface LoginCredentials {
  userName: string;
  password: string;
}

export function createLoginPayload(userName: string, password: string) {
  return {
    userName: userName.trim(),
    userPassword: md5(password),
  };
}

function databaseAuthUrl(path: string): string {
  const base = (import.meta.env.VITE_DB_ADAPTER_BASE || DEFAULT_DATABASE_AUTH_BASE).replace(/\/$/, '');
  return `${base}${path}`;
}

async function postDatabaseAuth<T>(
  url: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json() as DatabaseAuthResponse<T>;
  if (!response.ok || payload.error)
    throw new Error(payload.error || `数据库认证接口异常：HTTP ${response.status}`);
  if (payload.data === undefined)
    throw new Error('数据库认证接口返回为空');
  return payload.data;
}

export async function loginSwpUser(credentials: LoginCredentials): Promise<AuthUser> {
  if (getDataSource() === 'database') {
    return postDatabaseAuth<AuthUser>(
      databaseAuthUrl('/auth/login'),
      createLoginPayload(credentials.userName, credentials.password),
    );
  }

  const response = await postJson<AuthUser>(
    apiUrl(LOGIN_PATH),
    createLoginPayload(credentials.userName, credentials.password),
    { auth: 'omit' },
  );

  if (response.code !== 200 || !response.data?.token)
    throw new Error(response.message || '登录失败，请检查账号和密码');

  return response.data;
}

export async function confirmSwpRole(
  roleId: number | string,
  token: string,
): Promise<string | undefined> {
  if (getDataSource() === 'database') {
    const result = await postDatabaseAuth<{ token: string }>(
      databaseAuthUrl('/auth/role-confirm'),
      { roleId },
      token,
    );
    if (!result.token)
      throw new Error('角色确认接口未返回登录令牌');
    return result.token;
  }

  const response = await postJson<unknown>(
    apiUrl(ROLE_CONFIRM_PATH),
    { roleId, token },
  );

  if (response.code !== 200)
    throw new Error(response.message || '角色确认失败');

  return undefined;
}
