function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** 对齐主项目 traverseKeyPath */
export function traverseKeyPath(keys: string[], obj: unknown, index?: number): string {
  if (!isObject(obj))
    return '';
  let i = 0;
  let res: unknown = obj;
  while (i <= keys.length - 1) {
    if (index !== undefined && index !== null && isArray(res)) {
      res = res[index];
    }
    else {
      res = (res as Record<string, unknown>)[keys[i]];
      i++;
    }
    if (!res)
      break;
  }
  if (res === null || res === undefined)
    return '';
  if (typeof res === 'object')
    return '';
  return String(res);
}
