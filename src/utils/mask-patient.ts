/** 患者姓名展示脱敏（走廊/标签/侧栏统一规则） */
export function maskSickName(name: string): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed)
    return '';
  if (trimmed.includes('*'))
    return trimmed;
  if (trimmed.length <= 1)
    return trimmed;
  if (trimmed.length === 2)
    return `${trimmed[0]}*`;
  return `${trimmed[0]}*${trimmed[trimmed.length - 1]}`;
}

/** 床位标签/列表用：空床返回「空床」，否则脱敏姓名 */
export function displayPatientName(sickName?: string | null, isOccupied = true): string {
  if (!isOccupied || !sickName?.trim())
    return '空床';
  return maskSickName(sickName);
}
