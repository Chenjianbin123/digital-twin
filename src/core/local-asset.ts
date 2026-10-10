/** 模板附带的终端图片路径在演示版中用内嵌图替代，不访问终端文件服务。 */
const TEMPLATE_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72"><rect width="96" height="72" rx="8" fill="#edf5fa"/><path d="M40 20h16v12h12v16H56v12H40V48H28V32h12z" fill="#538fab"/></svg>')}`;

export function resolveLocalAsset(path?: string): string {
  const value = path?.trim() ?? '';
  if (!value) return '';
  if (/^(data:|blob:)/i.test(value)) return value;
  if (/^\/?swp_upload\//i.test(value)) return TEMPLATE_IMAGE;
  // 限制为部署包中的静态素材；协议相对地址、接口路径和外部地址均不可用。
  if (!/^\/?(?:images|models|videos|fonts|assets)\//.test(value)
    || value.includes('..') || value.includes('\\')) return '';
  return `/${value.replace(/^\//, '')}`;
}
