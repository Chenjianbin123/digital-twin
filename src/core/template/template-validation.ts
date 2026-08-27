interface TemplateContentLike<TNode = unknown> {
  width?: number | string;
  height?: number | string;
  data?: TNode[];
}

export function validateTemplateContent<T extends TemplateContentLike>(content: T): T & {
  width: number;
  height: number;
  data: NonNullable<T['data']>;
} {
  const width = Number(content.width);
  const height = Number(content.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0)
    throw new Error('模板尺寸无效');
  if (!Array.isArray(content.data) || content.data.length === 0)
    throw new Error('模板没有可显示内容');
  return { ...content, width, height, data: content.data as NonNullable<T['data']> };
}
