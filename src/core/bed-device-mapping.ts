import type {
  BedDeviceInfoData,
  BedDeviceInfoVo,
  BedSickInfoVo,
  BedSickNursingLabelItem,
} from '../types/bed-device.ts';
import type { TwinBedEntity } from '../types/twin.ts';
import type { DoorSickInfo, NursingLabelItem } from '../types/ward.ts';

function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined)
    return fallback;
  return String(value);
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function hasPatientData(sick: BedSickInfoVo | null | undefined): sick is BedSickInfoVo {
  if (!sick)
    return false;
  return Boolean(
    text(sick.sickName).trim()
    || text(sick.sickNo).trim()
    || text(sick.sickSerialNo).trim()
    || text(sick.sickIdentifier).trim(),
  );
}

function mapNursingLabels(
  labels: BedSickNursingLabelItem[] | null | undefined,
): NursingLabelItem[] {
  return (labels ?? [])
    .filter(item => text(item.labelCode).trim() || text(item.labelName).trim())
    .map(item => ({
      labelCode: text(item.labelCode),
      labelName: text(item.labelName),
      labelColor: text(item.labelColor, '#456BAF'),
      labelTextColor: text(item.labelTextColor, '#ffffff'),
    }));
}

function mapBedSickInfo(
  sick: BedSickInfoVo | null | undefined,
  device: BedDeviceInfoVo,
  labels: NursingLabelItem[],
): DoorSickInfo | undefined {
  if (!hasPatientData(sick))
    return undefined;

  const raw = (sick ?? {}) as Record<string, unknown>;
  return {
    ...raw,
    bedCode: text(sick?.bedCode, text(device.bedCode)),
    bedName: text(sick?.bedName, text(device.bedName)),
    sickName: text(sick?.sickName),
    sickSex: text(sick?.sickSex),
    sickAge: text(sick?.sickAge),
    sickBirthday: text(sick?.sickBirthday),
    sickNo: text(sick?.sickNo),
    sickInTime: text(sick?.sickInTime),
    nursingLevel: text(sick?.nursingLevel),
    nursingColor: text(sick?.nursingColor),
    sickAllergy: text(sick?.sickAllergy),
    sickIsolation: text(sick?.sickIsolation),
    sickDiet: text(sick?.sickDiet),
    sickSafetyPrecautions: text(sick?.sickSafetyPrecautions),
    visitDoctorName: text(sick?.visitDoctorName),
    visitDoctorUserDuty: '',
    visitDoctorUserProfessional: '',
    dutyNurseName: text(sick?.dutyNurseName),
    dutyNurseUserProfessional: '',
    visitDoctorUserRemark: text(sick?.visitDoctorSynopsis),
    dutyNurseUserRemark: text(sick?.dutyNurseSynopsis),
    visitDoctorUserPic: '',
    dutyNurseUserPic: '',
    areaHeadNurseName: text(sick?.areaHeadNurseName),
    areaHeadNurseUserPic: '',
    nursingLabels: labels,
  };
}

function resolveOnlineState(device: BedDeviceInfoVo, previous: boolean): boolean {
  const value = String(device.isOnline ?? '').trim().toLowerCase();
  if (value === '0' || value === 'false')
    return false;
  if (value === '1' || value === 'true')
    return true;
  return previous;
}

/** 防止异步返回的旧 SN 或错误设备响应覆盖当前床位。 */
export function isBedDeviceResponseApplicable(
  bed: Pick<TwinBedEntity, 'deviceCode'>,
  requestedDeviceCode: string,
  data: BedDeviceInfoData,
): boolean {
  const requested = requestedDeviceCode.trim();
  const current = bed.deviceCode.trim();
  const response = text(data.bedDeviceInfoVo?.deviceCode).trim();
  if (!requested || current !== requested)
    return false;
  return !response || response === requested;
}

/**
 * 空床没有患者时，即使后端没有分配床头机 SN，也可以正常展示空床状态；
 * 只有在院床位缺少 SN 才是需要提醒护理人员的数据问题。
 */
export function shouldWarnForMissingBedDevice(
  bed: Pick<TwinBedEntity, 'deviceCode' | 'isOccupied'> & { bedName?: string },
): boolean {
  const emptyBedLabel = new Set(['空床', '无患者', '未入住', '未分配']);
  return !text(bed.deviceCode).trim()
    && bed.isOccupied
    && !emptyBedLabel.has(text(bed.bedName).trim());
}

/** 将床头机接口响应写入单个床位，床头患者字段优先于门口机快照。 */
export function applyBedDeviceInfoToTwinBed(
  bed: TwinBedEntity,
  data: BedDeviceInfoData,
): TwinBedEntity {
  const device = data.bedDeviceInfoVo;
  const labels = mapNursingLabels(data.bedSickNursingLabelList);
  const sick = mapBedSickInfo(data.bedSickInfoVo, device, labels);
  const bedCode = text(device.bedCode, bed.bedCode);
  const bedName = text(device.bedName, bed.bedName);
  const deviceCode = text(device.deviceCode, bed.deviceCode);
  const templateId = positiveNumber(device.templateId);

  bed.bedCode = bedCode;
  bed.bedName = bedName;
  bed.deviceCode = deviceCode;
  bed.templateId = templateId;
  bed.bedDeviceInfo = device;
  bed.bedSickInfo = data.bedSickInfoVo ?? null;
  bed.sickInfo = sick;
  bed.nursingLabels = labels;
  bed.nursingColor = sick?.nursingColor || text(data.bedSickInfoVo?.nursingColor) || undefined;
  bed.nursingLevel = sick?.nursingLevel || text(data.bedSickInfoVo?.nursingLevel) || undefined;
  bed.isOccupied = !!sick;
  bed.isOnline = resolveOnlineState(device, bed.isOnline);
  if (bed.statusBarInfo) {
    bed.statusBarInfo = {
      ...bed.statusBarInfo,
      bedCode,
      deviceCode,
    };
  }
  return bed;
}
