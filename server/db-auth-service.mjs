import { timingSafeEqual } from 'node:crypto';

const FULL_AREA_ROLE_NAMES = new Set(['超级管理员', '管理员', '护士']);

function hasFullAreaAccess(roleName) {
  return FULL_AREA_ROLE_NAMES.has(String(roleName || '').trim());
}

export class DbAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DbAuthError';
    this.status = status;
  }
}

function comparePassword(expected, provided) {
  const normalizedExpected = String(expected || '').toLowerCase();
  const normalizedProvided = String(provided || '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalizedExpected) || !/^[a-f0-9]{32}$/.test(normalizedProvided))
    return false;
  return timingSafeEqual(Buffer.from(normalizedExpected), Buffer.from(normalizedProvided));
}

function bearerToken(value) {
  const match = /^Bearer\s+(.+)$/i.exec(String(value || '').trim());
  if (!match)
    throw new DbAuthError(401, '登录已过期，请重新登录');
  return match[1];
}

export function createDbAuthService({ query, auth }) {
  async function rolesForUser(userId, roleId) {
    return query(
      `
        SELECT r.id, r.role_name roleName, r.role_code roleCode
        FROM sys_user_role ur
        JOIN sys_role r ON r.id = ur.role_id
        WHERE ur.user_id = ?${roleId == null ? '' : ' AND ur.role_id = ?'}
          AND IFNULL(r.is_enable, '1') = '1'
        ORDER BY r.role_level, r.id
      `,
      roleId == null ? [Number(userId)] : [Number(userId), Number(roleId)],
    );
  }

  async function login(credentials, request = {}) {
    const userName = String(credentials?.userName || '').trim();
    const userPassword = String(credentials?.userPassword || '').trim();
    if (!userName || !userPassword)
      throw new DbAuthError(400, '请输入平台账号和登录密码');

    const users = await query(
      `
        SELECT u.id, u.user_name, u.user_password, u.user_realname, u.user_pic,
               u.is_enable, u.is_delete
        FROM sys_user u
        WHERE u.user_name = ?
        LIMIT 1
      `,
      [userName],
    );
    const user = users[0];
    if (!user || !comparePassword(user.user_password, userPassword))
      throw new DbAuthError(401, '用户名或密码错误');
    if (String(user.is_delete || '0') === '1')
      throw new DbAuthError(403, '账号已停用');
    if (String(user.is_enable ?? '1') !== '1')
      throw new DbAuthError(403, '账号已停用');

    const roleList = await rolesForUser(user.id);
    if (!roleList.length)
      throw new DbAuthError(403, '当前账号未分配角色，请联系管理员');

    await query(
      'INSERT INTO sys_login_log (user_id, user_name, login_ip, login_time) VALUES (?, ?, ?, NOW())',
      [user.id, user.user_name, String(request.ip || '').slice(0, 40)],
    );

    return {
      id: user.id,
      userName: user.user_name,
      userRealname: user.user_realname || '',
      userPic: user.user_pic || '',
      token: auth.signPending(user.id),
      roleList,
    };
  }

  async function confirmRole(pendingToken, roleId) {
    const normalizedRoleId = Number(roleId);
    if (!Number.isInteger(normalizedRoleId) || normalizedRoleId <= 0)
      throw new DbAuthError(400, '角色参数无效');
    let claims;
    try {
      claims = auth.verifyPending(pendingToken);
    }
    catch {
      throw new DbAuthError(401, '登录已过期，请重新登录');
    }
    const roles = await rolesForUser(claims.userId, normalizedRoleId);
    if (!roles.length)
      throw new DbAuthError(403, '无权使用该角色');
    return { token: auth.signSession(claims.userId, normalizedRoleId) };
  }

  async function verifySession(sessionToken) {
    let claims;
    try {
      claims = auth.verifySession(sessionToken);
    }
    catch {
      throw new DbAuthError(401, '登录已过期，请重新登录');
    }

    const active = await query(
      `
        SELECT 1 active, r.role_name roleName
        FROM sys_user_role ur
        JOIN sys_user u ON u.id = ur.user_id
        JOIN sys_role r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.role_id = ?
          AND IFNULL(u.is_enable, '1') = '1'
          AND IFNULL(u.is_delete, '0') <> '1'
          AND IFNULL(r.is_enable, '1') = '1'
        LIMIT 1
      `,
      [claims.userId, claims.roleId],
    );
    if (!active.length)
      throw new DbAuthError(401, '登录已失效，请重新登录');
    return { ...claims, roleName: active[0].roleName || '' };
  }

  async function listAuthorizedAreas(sessionToken) {
    const { roleId, roleName } = await verifySession(sessionToken);
    const fullAreaAccess = hasFullAreaAccess(roleName);
    return query(
      `
        SELECT a.id, a.area_code areaCode, a.area_name areaName,
               COUNT(DISTINCT r.id) roomCount,
               COUNT(DISTINCT b.id) bedCount,
               COUNT(DISTINCT d.id) deviceCount
        FROM hosp_area_info a
        ${fullAreaAccess ? '' : 'JOIN sys_role_area_data rad ON rad.area_id = a.id AND rad.role_id = ?'}
        LEFT JOIN hosp_sickroom_info r ON r.area_id = a.id AND IFNULL(r.is_enable, '1') = '1'
        LEFT JOIN hosp_bed_info b ON b.area_id = a.id AND IFNULL(b.is_enable, '1') = '1'
        LEFT JOIN swp_device_info d ON d.area_id = a.id AND IFNULL(d.is_enable, '1') = '1'
        WHERE IFNULL(a.is_enable, '1') = '1'
        GROUP BY a.id, a.area_code, a.area_name
        ORDER BY bedCount DESC, deviceCount DESC, a.sort, a.id
        LIMIT 100
      `,
      fullAreaAccess ? [] : [roleId],
    );
  }

  async function assertAreaAccess(sessionToken, areaCode) {
    const { roleId, roleName } = await verifySession(sessionToken);
    const areas = await query(
      `
        SELECT a.id, a.area_code, a.area_out_code
        FROM hosp_area_info a
        WHERE (a.area_code = ? OR a.area_out_code = ? OR CAST(a.id AS CHAR) = ?)
          AND IFNULL(a.is_enable, '1') = '1'
        LIMIT 1
      `,
      [areaCode, areaCode, areaCode],
    );
    const area = areas[0];
    if (!area)
      throw new DbAuthError(404, `未找到病区：${areaCode}`);
    if (hasFullAreaAccess(roleName))
      return area;
    const allowed = await query(
      'SELECT 1 allowed FROM sys_role_area_data WHERE role_id = ? AND area_id = ? LIMIT 1',
      [roleId, area.id],
    );
    if (!allowed.length)
      throw new DbAuthError(403, '无权访问该病区');
    return area;
  }

  return {
    bearerToken,
    login,
    confirmRole,
    verifySession,
    listAuthorizedAreas,
    assertAreaAccess,
  };
}
