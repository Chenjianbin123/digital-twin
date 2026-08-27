import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbAuthService } from '../server/db-auth-service.mjs';

const md5Password = '0123456789abcdef0123456789abcdef';

function createFixture(overrides = {}) {
  const calls = [];
  const fixture = {
    user: {
      id: 17,
      user_name: 'nurse01',
      user_password: md5Password,
      user_realname: '值班护士',
      user_pic: '/avatar.png',
      is_enable: '1',
      is_delete: '0',
    },
    roles: [{ id: 3, roleName: '护士', roleCode: 'nurse' }],
    roleAllowed: true,
    areas: [{ id: 72, areaCode: '2001', areaName: '一病区', roomCount: 6, bedCount: 12, deviceCount: 18 }],
    area: { id: 72, area_code: '2001', area_out_code: 'A-2001' },
    areaAllowed: true,
    areaListAllowed: true,
    sessionActive: true,
    currentRoleName: '普通角色',
    ...overrides,
  };
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT 1 active') && sql.includes('FROM sys_user_role ur'))
      return fixture.sessionActive ? [{ active: 1, roleName: fixture.currentRoleName }] : [];
    if (sql.includes('FROM sys_user u'))
      return fixture.user ? [fixture.user] : [];
    if (sql.includes('FROM sys_user_role ur') && sql.includes('JOIN sys_role r')) {
      if (sql.includes('WHERE ur.user_id = ? AND ur.role_id = ?'))
        return fixture.roleAllowed ? fixture.roles.filter(role => role.id === Number(params[1])) : [];
      return fixture.roles;
    }
    if (sql.includes('FROM hosp_area_info a') && sql.includes('JOIN sys_role_area_data'))
      return fixture.areaListAllowed ? fixture.areas : [];
    if (sql.includes('FROM hosp_area_info a') && sql.includes('COUNT(DISTINCT r.id) roomCount'))
      return fixture.areas;
    if (sql.includes('FROM hosp_area_info a') && sql.includes('WHERE (a.area_code'))
      return fixture.area ? [fixture.area] : [];
    if (sql.includes('FROM sys_role_area_data'))
      return fixture.areaAllowed ? [{ allowed: 1 }] : [];
    if (sql.includes('INSERT INTO sys_login_log'))
      return { insertId: 1 };
    throw new Error(`Unexpected query: ${sql}`);
  };
  const auth = {
    signPending: userId => `pending-${userId}`,
    signSession: (userId, roleId) => `session-${userId}-${roleId}`,
    verifyPending: token => token === 'pending-17' ? { userId: 17 } : (() => { throw new Error('bad token'); })(),
    verifySession: token => token === 'session-17-3' ? { userId: 17, roleId: 3 } : (() => { throw new Error('bad token'); })(),
  };
  return { service: createDbAuthService({ query, auth }), calls };
}

test('database login returns minimal user data and active roles', async () => {
  const { service, calls } = createFixture();
  const result = await service.login({ userName: ' nurse01 ', userPassword: md5Password }, { ip: '127.0.0.1' });

  assert.deepEqual(result, {
    id: 17,
    userName: 'nurse01',
    userRealname: '值班护士',
    userPic: '/avatar.png',
    token: 'pending-17',
    roleList: [{ id: 3, roleName: '护士', roleCode: 'nurse' }],
  });
  assert.equal('user_password' in result, false);
  assert.deepEqual(calls[0].params, ['nurse01']);
});

test('database login rejects invalid, disabled, and roleless users', async () => {
  await assert.rejects(createFixture({ user: null }).service.login({ userName: 'x', userPassword: md5Password }), /用户名或密码错误/);
  await assert.rejects(createFixture().service.login({ userName: 'nurse01', userPassword: 'f'.repeat(32) }), /用户名或密码错误/);
  await assert.rejects(createFixture({ user: { id: 17, user_name: 'nurse01', user_password: md5Password, is_enable: '0', is_delete: '0' } }).service.login({ userName: 'nurse01', userPassword: md5Password }), /账号已停用/);
  await assert.rejects(createFixture({ roles: [] }).service.login({ userName: 'nurse01', userPassword: md5Password }), /未分配角色/);
});

test('role confirmation and area access are verified on the server', async () => {
  const { service } = createFixture();
  assert.deepEqual(await service.confirmRole('pending-17', 3), { token: 'session-17-3' });
  await assert.rejects(createFixture({ roleAllowed: false }).service.confirmRole('pending-17', 3), /无权使用该角色/);
  assert.deepEqual(await service.listAuthorizedAreas('session-17-3'), [
    { id: 72, areaCode: '2001', areaName: '一病区', roomCount: 6, bedCount: 12, deviceCount: 18 },
  ]);
  assert.equal((await service.assertAreaAccess('session-17-3', '2001')).id, 72);
  await assert.rejects(createFixture({ areaAllowed: false }).service.assertAreaAccess('session-17-3', '2001'), /无权访问该病区/);
});

test('protected access rejects sessions whose account or role assignment was revoked', async () => {
  const { service } = createFixture({ sessionActive: false });
  await assert.rejects(service.listAuthorizedAreas('session-17-3'), /登录已失效/);
  await assert.rejects(service.assertAreaAccess('session-17-3', '2001'), /登录已失效/);
});

test('administrator and nurse roles can list and enter every enabled area', async () => {
  for (const roleName of ['超级管理员', '管理员', '护士']) {
    const { service } = createFixture({
      currentRoleName: roleName,
      areaListAllowed: false,
      areaAllowed: false,
    });
    assert.deepEqual(await service.listAuthorizedAreas('session-17-3'), [
      { id: 72, areaCode: '2001', areaName: '一病区', roomCount: 6, bedCount: 12, deviceCount: 18 },
    ]);
    assert.equal((await service.assertAreaAccess('session-17-3', '2001')).id, 72);
  }
});

test('other roles still require explicit area authorization', async () => {
  const { service } = createFixture({
    currentRoleName: '医生',
    areaListAllowed: false,
    areaAllowed: false,
  });
  assert.deepEqual(await service.listAuthorizedAreas('session-17-3'), []);
  await assert.rejects(service.assertAreaAccess('session-17-3', '2001'), /无权访问该病区/);
});
