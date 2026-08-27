import assert from 'node:assert/strict';
import test from 'node:test';

import { validateTemplateContent } from './template/template-validation.ts';

test('rejects templates without usable nodes instead of rendering a blank screen', () => {
  assert.throws(
    () => validateTemplateContent({ width: 1920, height: 1080, data: [] }),
    /模板没有可显示内容/,
  );
});

test('rejects invalid template dimensions', () => {
  assert.throws(
    () => validateTemplateContent({ width: 0, height: 1080, data: [{ type: 'text' }] }),
    /模板尺寸无效/,
  );
});

test('keeps valid template dimensions and nodes', () => {
  const parsed = validateTemplateContent({
    width: 1920,
    height: 1080,
    data: [{ type: 'text', text: '病房' }],
  });
  assert.equal(parsed.width, 1920);
  assert.equal(parsed.height, 1080);
  assert.equal(parsed.data.length, 1);
});
