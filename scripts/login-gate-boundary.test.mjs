import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString } from 'sass';

const loginGate = readFileSync(new URL('../src/components/SwpLoginGate.vue', import.meta.url), 'utf8');

const loginStyles = readFileSync(new URL('../src/styles/swp-login.scss', import.meta.url), 'utf8');
const compiledStyles = compileString(loginStyles).css;

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
  assert.ok(loginGate.includes('<style scoped lang="scss" src="@/styles/swp-login.scss"'));
  assert.match(compiledStyles, /@media \(max-width: 768px\)/);
  assert.match(compiledStyles, /height: 100dvh/);
  assert.match(compiledStyles, /overflow-wrap: anywhere/);
});

test('login gate keeps sign-in instructions in Chinese', () => {
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

test('login gate uses an adaptive desktop card layout without an inner scrollbar', () => {
  assert.match(loginGate, /swp-login__card/);
  assert.match(compiledStyles, /\.swp-login__rail\s*\{[^}]*width: clamp\(/);
  assert.match(compiledStyles, /\.swp-login__card\s*\{[^}]*max-height: 100%/);
  assert.match(compiledStyles, /\.swp-login__card\s*\{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(compiledStyles, /\.swp-login__card\s*\{[^}]*overflow-y:\s*auto/);
});

test('login gate handles short and reduced-motion viewports', () => {
  assert.match(compiledStyles, /@media \(max-height:/);
  assert.match(compiledStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(compiledStyles, /env\(safe-area-inset-bottom\)/);
});

test('login gate copy matches the smart-ward digital-twin context', () => {
  assert.match(loginGate, /进入智慧病房/);
  assert.match(loginGate, /工作空间/);
  assert.match(loginGate, /查看授权病区的实时态势/);
  assert.match(loginGate, /设备联动/);
  assert.match(loginGate, /护理协同/);
});

test('login gate adds layered technology motion with a reduced-motion fallback', () => {
  assert.match(loginGate, /class="swp-login__spatial" aria-hidden="true"/);
  assert.match(compiledStyles, /@keyframes login-cube-float/);
  assert.match(compiledStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.swp-login__cube\s*\{\s*animation: none/);
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
  assert.match(compiledStyles, /\.swp-login__card\s*\{[^}]*background: linear-gradient/);
  assert.match(compiledStyles, /\.swp-login__card::before\s*\{[^}]*pointer-events: none/);
  assert.match(compiledStyles, /button:focus-visible\s*\{[^}]*outline:/);
});

test('login gate keeps the digital-twin scene visible through a translucent card', () => {
  assert.match(compiledStyles, /backdrop-filter: blur\(/);
  assert.match(compiledStyles, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?backdrop-filter: none/);
});

test('login gate hides role selection while roles share the same access scope', () => {
  assert.match(loginGate, /const ENABLE_ROLE_SELECTION = false/);
  assert.match(loginGate, /if \(!ENABLE_ROLE_SELECTION\)/);
  assert.match(loginGate, /selectedRoleId\.value = String\(user\.roleList\[0\]\.id\)/);
  assert.match(loginGate, /await submitRole\(\)/);
});
