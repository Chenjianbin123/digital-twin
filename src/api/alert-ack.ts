import { apiUrl, postJson } from '@/api/http-client';
import type { AlertAckRecord } from '@/core/alert-ack';

export interface AlertAckPayload extends AlertAckRecord {
  roomName?: string;
  bedName?: string;
  title?: string;
}

export async function syncAlertAck(payload: AlertAckPayload): Promise<boolean> {
  const path = import.meta.env.VITE_ALERT_ACK_PATH?.trim();
  if (!path)
    return false;

  await postJson(apiUrl(path), payload, { timeoutMs: 4_000 });
  return true;
}
