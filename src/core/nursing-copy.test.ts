import assert from 'node:assert/strict';
import test from 'node:test';
import { NURSING_LOGIN_FAILURES, NURSING_STATUS_LABELS, nursingInformationNotice } from './nursing-copy.ts';

test('nursing notices retain uncertainty and distinguish missing from previous information', () => {
  const time = '2026-10-05T10:28:00Z';
  assert.equal(nursingInformationNotice('ready', time), '');
  assert.match(nursingInformationNotice('warning', time), /部分记录.*现场/);
  for (const status of ['error', 'stale'] as const) {
    assert.match(nursingInformationNotice(status, time), /上次记录/);
    for (const missing of [null, '', 'not-a-date']) {
      assert.match(nursingInformationNotice(status, missing), /暂未获取/);
      assert.doesNotMatch(nursingInformationNotice(status, missing), /上次记录/);
    }
  }
  assert.match(nursingInformationNotice('loading', time), /暂显示上次记录/);
  assert.doesNotMatch(nursingInformationNotice('loading'), /上次记录/);
});

test('routine status and login copy omit infrastructure terms and do not imply clinical completion', () => {
  for (const text of [...Object.values(NURSING_STATUS_LABELS), ...Object.values(NURSING_LOGIN_FAILURES)]) {
    assert.doesNotMatch(text, /HTTP|接口|后端|后台|业务码|网关|全量|已处理|无异常/);
  }
  assert.notEqual(NURSING_STATUS_LABELS.warning, NURSING_STATUS_LABELS.ready);
  assert.match(NURSING_LOGIN_FAILURES.auth, /账号和密码/);
  assert.match(NURSING_LOGIN_FAILURES.permission, /管理员/);
});
