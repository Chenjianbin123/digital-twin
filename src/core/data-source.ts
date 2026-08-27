export type DataSource = 'mock' | 'remote' | 'database';

export function resolveDataSource(value?: string): DataSource {
  return value === 'mock' || value === 'database' ? value : 'remote';
}
