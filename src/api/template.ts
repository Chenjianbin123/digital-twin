import { getDataSource } from '@/api/door-device';
import { fetchDatabaseTemplate } from '@/api/database-twin';
import { apiUrl, postJson } from '@/api/http-client';
import bedTemplate from '@/mock/bed-template-default.json';
import doorTemplateDefault from '@/mock/door-template-default.json';
import doorTemplateMain from '@/mock/door-template-main.json';
import type { SwpTemplateInfo } from '@/types/template';

const TEMPLATE_PATH = 'swp/swpTemplateInfo/querySwpTemplateInfoById';

const MOCK_TEMPLATES: Record<number, { name: string; content: string }> = {
  1: { name: '床头卡模板（本地）', content: bedTemplate.templateContent },
  3: { name: '门口机横屏模板（对齐主项目）', content: doorTemplateMain.templateContent },
  796: { name: '门口机横屏模板一', content: doorTemplateMain.templateContent },
  797: { name: '门口机竖屏模板（本地）', content: doorTemplateDefault.templateContent },
};

/** 对齐主项目 apiClient.basic.queryTemplate({ id }) */
export async function queryTemplateById(id: number): Promise<SwpTemplateInfo> {
  const dataSource = getDataSource();
  if (dataSource === 'mock') {
    await new Promise(r => setTimeout(r, 120));
    const mock = MOCK_TEMPLATES[id] ?? MOCK_TEMPLATES[1];
    return {
      id,
      templateName: mock.name,
      templateContent: mock.content,
      analyzeType: '1',
    };
  }

  if (dataSource === 'database')
    return fetchDatabaseTemplate(id);

  const res = await postJson<SwpTemplateInfo>(apiUrl(TEMPLATE_PATH), { id });
  if (res.code !== 200 || !res.data)
    throw new Error(res.message || '模板数据为空');
  if (!res.data.templateContent && res.data.templateJson)
    res.data.templateContent = typeof res.data.templateJson === 'string'
      ? res.data.templateJson
      : JSON.stringify(res.data.templateJson);
  if (!res.data.templateContent)
    throw new Error(res.message || '模板数据为空');
  console.info('[DoorTemplate] 模板接口返回', {
    id,
    name: res.data.templateName,
    contentLength: res.data.templateContent.length,
    analyzeType: res.data.analyzeType,
  });
  return res.data;
}
