import type { DoorMainStaff } from '@/types/ward';

export type DoorStaffRoleKey = 'deptDirector' | 'areaHeadNurse' | 'areaDirector';

export interface DoorStaffItem {
  role: string;
  roleKey: DoorStaffRoleKey;
  name: string;
  pic?: string;
}

const STAFF_DEFS: Array<{ role: string; roleKey: DoorStaffRoleKey; nameKey: keyof DoorMainStaff; picKey: keyof DoorMainStaff }> = [
  { role: '科主任', roleKey: 'deptDirector', nameKey: 'deptDirectorName', picKey: 'deptDirectorUserPic' },
  { role: '护士长', roleKey: 'areaHeadNurse', nameKey: 'areaHeadNurseName', picKey: 'areaHeadNurseUserPic' },
  { role: '主任', roleKey: 'areaDirector', nameKey: 'areaDirectorName', picKey: 'areaDirectorUserPic' },
];

export function buildMainStaffList(
  staff?: DoorMainStaff,
  options?: { primaryOnly?: boolean },
): DoorStaffItem[] {
  if (!staff)
    return [];

  const list: DoorStaffItem[] = [];

  for (const def of STAFF_DEFS) {
    const name = staff[def.nameKey] as string | undefined;
    if (!name)
      continue;

    list.push({
      role: def.role,
      roleKey: def.roleKey,
      name,
      pic: staff[def.picKey] as string | undefined,
    });
  }

  if (options?.primaryOnly)
    return list.filter(item => item.roleKey === 'deptDirector' || item.roleKey === 'areaHeadNurse');

  return list;
}
