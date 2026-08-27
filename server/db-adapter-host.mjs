export function resolveDbAdapterHost(rawHost = process.env.DB_ADAPTER_HOST) {
  return rawHost?.trim() || '127.0.0.1';
}
