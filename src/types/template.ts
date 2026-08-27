export interface TemplateNode {
  type?: string;
  title?: string;
  id?: string;
  key?: string;
  text?: string;
  left?: number | string;
  top?: number | string;
  width?: number | string;
  height?: number | string;
  zIndex?: number | string;
  background?: string;
  color?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  fontFamily?: string;
  textAlign?: string;
  justifyContent?: string;
  alignItems?: string;
  display?: string;
  borderRadius?: string;
  borderWidth?: number | string;
  borderColor?: string;
  border?: string;
  boxShadow?: string;
  opacity?: number | string;
  whiteSpace?: string;
  src?: string;
  svgText?: string;
  isRender?: string | boolean;
  class?: string;
  renderType?: string;
  interactionType?: string;
  ignore?: string | boolean;
  children?: TemplateNode[] | Record<string, TemplateNode>;
  [key: string]: unknown;
}

export interface TemplateContent {
  name?: string;
  width?: number | string;
  height?: number | string;
  background?: string;
  color?: string;
  isNew?: boolean;
  data?: TemplateNode[];
}

export interface SwpTemplateInfo {
  id: number;
  templateName?: string;
  templateContent: string;
  templateJson?: unknown;
  analyzeType?: string;
  templateType?: string;
  mainColor?: string;
}

export interface ParsedTemplate {
  width: number;
  height: number;
  isNew: boolean;
  /** 对齐主项目 template.analyzeType */
  analyzeType?: string;
  background: string;
  nodes: TemplateNode[];
}
