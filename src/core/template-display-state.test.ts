import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTemplateDisplayState,
  fitDisplayText,
  getImagePlaceholderLabel,
  getTemplateStatusCanvasSize,
} from './template/template-display-state.ts';

test('uses stable status canvas sizes for horizontal and vertical terminals', () => {
  assert.deepEqual(getTemplateStatusCanvasSize('horizontal'), { width: 960, height: 540 });
  assert.deepEqual(getTemplateStatusCanvasSize('vertical'), { width: 480, height: 720 });
});

test('distinguishes loading, missing template, render failure and image failure', () => {
  assert.equal(buildTemplateDisplayState('loading', 'door').title, '模板加载中');
  assert.equal(buildTemplateDisplayState('missing', 'door').title, '未配置门口机模板');
  assert.equal(buildTemplateDisplayState('error', 'bed').title, '床头屏模板加载失败');
  assert.equal(buildTemplateDisplayState('image-error', 'door').title, '图片资源加载失败');
});

test('keeps status detail concise and removes raw error URLs', () => {
  const state = buildTemplateDisplayState(
    'error',
    'door',
    'HTTP 404 http://192.168.96.104/swp/swpTemplateInfo/querySwpTemplateInfoById',
  );
  assert.equal(state.detail, 'HTTP 404，请检查模板接口或模板编号');
});

test('truncates long display text while preserving short text', () => {
  assert.equal(fitDisplayText('护理一区', 8), '护理一区');
  assert.equal(fitDisplayText('护理一区东侧十二床病房门口机', 8), '护理一区东侧十…');
});

test('uses a concise placeholder label for failed template images', () => {
  assert.equal(getImagePlaceholderLabel('患者头像'), '患者头像暂不可用');
  assert.equal(getImagePlaceholderLabel(''), '图片暂不可用');
  assert.equal(getImagePlaceholderLabel('护理一区患者头像照片'), '护理一区患者…暂不可用');
});
