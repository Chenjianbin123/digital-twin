import type { HospAreaRecord } from '../types/hospital-area.ts';

export interface AreaAccessPolicy {
  filterAreas(areas: HospAreaRecord[]): HospAreaRecord[];
  canSwitchArea(currentAreaId: number, targetAreaId: number): boolean;
}

export const allowAllAreaAccessPolicy: AreaAccessPolicy = {
  filterAreas: areas => [...areas],
  canSwitchArea: () => true,
};

export function resolveRememberedAreaId(
  areas: HospAreaRecord[],
  storedId?: string | number | null,
): number | null {
  if (storedId == null || String(storedId).trim() === '')
    return null;

  const id = Number(storedId);
  if (!Number.isInteger(id) || id <= 0)
    return null;

  return areas.some(area => area.id === id) ? id : null;
}

export function resolvePreferredAreaId(
  areas: HospAreaRecord[],
  storedId?: string | number | null,
  configuredId?: string | number | null,
): number | null {
  for (const candidate of [storedId, configuredId]) {
    const id = Number(candidate ?? 0);
    if (areas.some(area => area.id === id))
      return id;
  }
  return areas[0]?.id ?? null;
}
