/** 对齐主项目 queryHospHospitalInfo 返回 */
export interface HospitalInfo {
  id?: number;
  orgCode?: string;
  hospitalName?: string;
  /** 富文本 HTML */
  hospitalNote?: string;
  hospitalAddress?: string;
  hospitalLogoPic?: string;
  hospitalExpiryDate?: string;
  bedNum?: number;
  license?: string;
  remark?: string;
}
