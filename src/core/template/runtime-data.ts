import { buildBedTemplateData } from './data-mapper.ts';
import type { TwinBedEntity, TwinWardEntity } from '../../types/twin.ts';
import type { DoorTemplateData } from './door-data-mapper.ts';

/** 一次纹理只注入所属房床的数据，绝不复用其他运行时的数据仓库。 */
export function buildBedRuntimeData(bed: TwinBedEntity): Record<string, unknown> {
  const data = buildBedTemplateData(bed);
  if (!bed.isOccupied) {
    data.bedSickInfoVo = { bedName: bed.bedName, bedCode: bed.bedCode };
    data.bedSickNursingLabelList = [];
    data.statusBarInfo = { status: '', text: '' };
  }
  return { ...data, __emptyBedPreview: { value: !bed.isOccupied } };
}

export function buildDoorRuntimeData(room: TwinWardEntity, data: DoorTemplateData): Record<string, unknown> {
  const beds = data.bedDeviceList.map((bed, index) => ({
    ...bed,
    // 空床即使携带上次输液推送，也不能显示为当前患者状态。
    statusBarInfo: room.beds[index]?.isOccupied ? bed.statusBarInfo : undefined,
  }));
  return {
    ...data,
    bedNum: data.bedNum,
    bedDeviceList: beds,
    doorSickInfoList: beds.map(bed => bed.sickInfo),
    doorMainDoctorAndNurseVo: room.doorStaff ?? {},
    doorDeptUserList: room.doorDeptUsers ?? [],
  };
}
