import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

test('file proxy is registered before the overlapping SWP API prefix', () => {
  const fileRoutes = [...viteConfig.matchAll(/^\s*'\/swp_upload':/gm)].map(match => match.index);
  const apiRoutes = [...viteConfig.matchAll(/^\s*'\/swp':/gm)].map(match => match.index);
  assert.equal(fileRoutes.length, 2, '开发与预览配置都应声明 /swp_upload 代理');
  assert.equal(apiRoutes.length, 2, '开发与预览配置都应声明 /swp 代理');

  fileRoutes.forEach((fileRoute, index) => {
    assert.ok(fileRoute < apiRoutes[index], '/swp_upload 必须先于 /swp 注册，避免图片被转发到 API 端口');
  });
});
