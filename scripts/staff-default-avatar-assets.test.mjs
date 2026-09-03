import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const avatar = await readFile(new URL('../src/components/StaffAvatar.vue', import.meta.url), 'utf8');

test('医生和护士使用项目内默认头像资源', async () => {
  await access(new URL('../public/images/staff-default-doctor.png', import.meta.url));
  await access(new URL('../public/images/staff-default-nurse.png', import.meta.url));

  assert.match(avatar, /DEFAULT_DOCTOR_AVATAR\s*=\s*'\/images\/staff-default-doctor\.png'/);
  assert.match(avatar, /DEFAULT_NURSE_AVATAR\s*=\s*'\/images\/staff-default-nurse\.png'/);
  assert.match(avatar, /defaultAvatarSrc/);
  assert.match(avatar, /role === 'doctor' \|\| role === 'director'/);
  assert.match(avatar, /role === 'nurse'/);
});

test('头像接口图加载失败时回退到默认头像而不是破损图标', () => {
  assert.match(avatar, /primaryLoadFailed/);
  assert.match(avatar, /defaultLoadFailed/);
  assert.match(avatar, /activeSrc/);
  assert.match(avatar, /handleImageError/);
});

test('头像组件拒绝模板和设备图标图片', () => {
  assert.match(avatar, /function isTemplateOrIconImage/);
  assert.match(avatar, /safePrimarySrc/);
  assert.match(avatar, /\/swp_upload\/picture\/template\//);
  assert.match(avatar, /\/template\//);
  assert.match(avatar, /\/doorbtn\//);
  assert.match(avatar, /monitor\./);
  assert.match(avatar, /beddevice/);
  assert.match(avatar, /resolveFileUrl\(safePrimarySrc\.value\)/);
});

test('头像组件允许真实上传头像目录，不按日期目录一刀切拦截', () => {
  assert.doesNotMatch(avatar, /function isGenericSwpPictureAsset/);
  assert.doesNotMatch(avatar, /normalizedPath\.includes\('\/swp_upload\/picture\/'\)/);
});
