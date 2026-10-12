import { apiUrl, postJson } from '@/api/http-client';
import { getDataSource } from '@/api/door-device';
import type { AlertAckRecord } from '@/core/alert-ack';

export interface AlertAckPayload extends AlertAckRecord {
  roomName?: string;
  bedName?: string;
  title?: string;
}

export async function syncAlertAck(payload: AlertAckPayload): Promise<boolean> {
  if (getDataSource() === 'mock') return false;
  const path = import.meta.env.VITE_ALERT_ACK_PATH?.trim();
  if (!path)
    return false;

  const response = await postJson<{ code?: number; message?: string }>(apiUrl(path), payload, { timeoutMs: 4_000 });
  if (response.code !== 200) throw new Error(response.message || '后台未确认处理记录保存成功');
  return true;
}
