import type { HospitalInfo } from '@/types/hospital';
import type { SwpTemplateInfo } from '@/types/template';
import type { StatusHistoryEntry, TwinAreaEntity } from '@/types/twin';
import { AUTH_EXPIRED_EVENT, clearAuthSession, getSessionToken } from '@/core/auth-session';

export interface DatabaseAreaOption {
  id: number;
  areaCode: string;
  areaName: string;
  roomCount: number;
  bedCount: number;
  deviceCount: number;
}

export interface DatabaseTwinPayload {
  area: TwinAreaEntity;
  deviceCodes: string[];
  history: StatusHistoryEntry[];
  hospitalInfo: HospitalInfo | null;
  warnings: string[];
  fetchedAt: string;
}

interface AdapterResponse<T> {
  code?: number;
  data?: T;
  error?: string;
}

const DEFAULT_ADAPTER_BASE = '/db-adapter';

function getAdapterBaseUrl(): string {
  return (import.meta.env.VITE_DB_ADAPTER_BASE || DEFAULT_ADAPTER_BASE).replace(/\/$/, '');
}

export function getDatabaseAreaCode(): string {
  return import.meta.env.VITE_DB_AREA_CODE?.trim() || '2001';
}

function expireDatabaseAuthentication(message: string): void {
  const hadSession = !!getSessionToken();
  clearAuthSession();
  if (hadSession && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message } }));
}

async function getAdapterJson<T>(path: string): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${getAdapterBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = (await res.json()) as AdapterResponse<T>;

  if (res.status === 401 || res.status === 403 || payload.code === 401 || payload.code === 403) {
    const message = payload.error || '登录已过期，请重新登录';
    expireDatabaseAuthentication(message);
    throw new Error(message);
  }

  if (!res.ok || payload.error)
    throw new Error(payload.error || `数据库适配接口异常：HTTP ${res.status}`);

  if (payload.data === undefined)
    throw new Error('数据库适配接口返回为空');

  return payload.data;
}

export async function fetchDatabaseAreas(): Promise<DatabaseAreaOption[]> {
  return getAdapterJson<DatabaseAreaOption[]>('/api/areas');
}

export async function fetchDatabaseTwinArea(areaCode = getDatabaseAreaCode()): Promise<DatabaseTwinPayload> {
  return getAdapterJson<DatabaseTwinPayload>(`/api/areas/${encodeURIComponent(areaCode)}/twin`);
}

export async function fetchDatabaseHospitalInfo(): Promise<HospitalInfo | null> {
  return getAdapterJson<HospitalInfo | null>('/api/hospital');
}

export async function fetchDatabaseTemplate(id: number): Promise<SwpTemplateInfo> {
  return getAdapterJson<SwpTemplateInfo>(`/api/templates/${encodeURIComponent(String(id))}`);
}
