export const BED_WIDTH = 1.42;
export const BED_DEPTH = 3.08;
export const BED_HEAD_Z = -1.46;
export const BED_FOOT_Z = BED_HEAD_Z + BED_DEPTH;
export const MIN_BED_CLEARANCE = 1.35;

export function resolveBedVisualScale(bedCount: number) {
  const sizeBoost = 1.34;
  if (bedCount >= 5)
    return sizeBoost * 0.94;
  if (bedCount >= 4)
    return sizeBoost;
  if (bedCount >= 3)
    return sizeBoost * 1.04;
  return sizeBoost * 1.08;
}
