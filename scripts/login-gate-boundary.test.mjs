import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loginGate = readFileSync(new URL('../src/components/SwpLoginGate.vue', import.meta.url), 'utf8');

test('login gate uses the selected nurse-station visual and accessible credentials form', () => {
  assert.match(loginGate, /login-bg\.jpg/);
  assert.match(loginGate, /name="username"/);
  assert.match(loginGate, /name="password"/);
  assert.match(loginGate, /showPassword/);
  assert.match(loginGate, /aria-live="polite"/);
  assert.match(loginGate, /正在登录/);
});

test('login gate requires explicit SWP role confirmation before emitting authentication', () => {
  assert.match(loginGate, /loginSwpUser/);
  assert.match(loginGate, /writePendingAuth/);
  assert.match(loginGate, /请选择本次值班角色/);
  assert.match(loginGate, /confirmSwpRole/);
  assert.match(loginGate, /replacePendingAuthToken/);
  assert.match(loginGate, /confirmAuthRole/);
  assert.match(loginGate, /emit\(["']authenticated["'], session\)/);
});

test('login gate has a bounded mobile layout', () => {
  assert.match(loginGate, /@media \(max-width: 768px\)/);
  assert.match(loginGate, /min-height: 100dvh/);
  assert.match(loginGate, /overflow-wrap: anywhere/);
});

test('login gate presents a Chinese-only sign-in surface', () => {
  assert.match(loginGate, /智慧病房数字孪生平台/);
  assert.match(loginGate, /登录/);

  for (const obsoleteCopy of [
    'LIVE WARD SYSTEM',
    'DNK MEDICAL',
    'SMART WARD COMMAND',
    'STAFF ACCESS',
    'ROLE CONFIRMATION',
    '值班人员登录',
    '使用 SWP 平台账号验证身份',
    '进入护士站',
    '智慧病房服务',
    '安全连接',
  ]) {
    assert.doesNotMatch(loginGate, new RegExp(obsoleteCopy));
  }
});

test('login gate uses an adaptive desktop card layout', () => {
  assert.match(loginGate, /swp-login__card/);
  assert.match(loginGate, /@media \(min-width: 1200px\)/);
  assert.match(loginGate, /@media \(min-width: 769px\) and \(max-width: 1199px\)/);
  assert.match(loginGate, /width: min\(100% - 48px, 560px\)/);
  assert.match(loginGate, /max-height: calc\(100dvh - 64px\)/);
});

test('login gate handles short and reduced-motion viewports', () => {
  assert.match(loginGate, /@media \(max-height: 720px\)/);
  assert.match(loginGate, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(loginGate, /100svh/);
  assert.match(loginGate, /env\(safe-area-inset-bottom\)/);
});

test('login gate copy matches the smart-ward digital-twin context', () => {
  assert.match(loginGate, /进入智慧病房/);
  assert.match(loginGate, /授权入口/);
  assert.match(loginGate, /查看授权病区的实时态势/);
  assert.match(loginGate, /设备联动/);
  assert.match(loginGate, /护理协同/);
});

test('login gate adds layered technology motion with a reduced-motion fallback', () => {
  assert.match(loginGate, /swp-login__tech-grid/);
  assert.match(loginGate, /swp-login__scanline/);
  assert.match(loginGate, /swp-login__signal/);
  assert.match(loginGate, /@keyframes login-grid-drift/);
  assert.match(loginGate, /@keyframes login-scan/);
  assert.match(loginGate, /@keyframes login-card-sweep/);
  assert.match(
    loginGate,
    /\.swp-login__tech-grid[\s\S]*animation:\s*none !important/,
  );
});

test('login gate makes the two-stage access flow visible in the card hierarchy', () => {
  assert.match(loginGate, /swp-login__steps/);
  assert.match(loginGate, /账号验证/);
  assert.match(loginGate, /角色确认/);
  assert.match(loginGate, /swp-login__support/);
  assert.match(loginGate, /病区态势/);
  assert.match(loginGate, /设备联动/);
  assert.match(loginGate, /护理协同/);
});

test('login gate uses layered accent styling instead of a single flat cyan surface', () => {
  assert.match(loginGate, /--login-warm/);
  assert.match(loginGate, /login-card-breathe/);
  assert.match(loginGate, /login-amber-pulse/);
  assert.match(loginGate, /&::before/);
  assert.match(loginGate, /swp-login__support-item/);
});

test('login gate keeps the digital-twin scene visible through a translucent card', () => {
  assert.match(loginGate, /--login-panel-alpha:\s*0\.62/);
  assert.match(
    loginGate,
    /--login-panel:\s*rgba\(7, 25, 38, var\(--login-panel-alpha\)\)/,
  );
  assert.match(loginGate, /backdrop-filter:\s*blur\(18px\)/);
  assert.match(loginGate, /rgba\(3, 13, 21, 0\.58\)/);
});
