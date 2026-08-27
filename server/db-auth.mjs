import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_PENDING_TTL_SECONDS = 5 * 60;
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_PENDING_TTL_SECONDS = 60 * 60;
const MAX_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function validTtl(value, fallback, maximum, label) {
  const ttl = Number(value ?? fallback);
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > maximum)
    throw new Error(`${label}必须是有效的正整数秒数`);
  return ttl;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  }
  catch {
    throw new Error('令牌无效');
  }
}

export function createDbAuth(options = {}) {
  const secret = options.secret ?? randomBytes(32).toString('hex');
  if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('DB_AUTH_SECRET 至少 32 个字符');
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const pendingTtlSeconds = validTtl(
    options.pendingTtlSeconds,
    DEFAULT_PENDING_TTL_SECONDS,
    MAX_PENDING_TTL_SECONDS,
    '临时令牌有效期',
  );
  const sessionTtlSeconds = validTtl(
    options.sessionTtlSeconds,
    DEFAULT_SESSION_TTL_SECONDS,
    MAX_SESSION_TTL_SECONDS,
    '会话令牌有效期',
  );

  function signature(payload) {
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }

  function sign(type, userId, roleId, ttlSeconds) {
    const issuedAt = now();
    const payload = encode({
      type,
      userId: Number(userId),
      ...(roleId == null ? {} : { roleId: Number(roleId) }),
      issuedAt,
      expiresAt: issuedAt + ttlSeconds,
    });
    return `${payload}.${signature(payload)}`;
  }

  function verify(token, expectedType) {
    if (typeof token !== 'string')
      throw new Error('令牌无效');
    const [payload, providedSignature, extra] = token.split('.');
    if (!payload || !providedSignature || extra)
      throw new Error('令牌无效');
    const expectedSignature = signature(payload);
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer))
      throw new Error('令牌无效');

    const claims = decode(payload);
    if (claims.type !== expectedType)
      throw new Error('令牌类型无效');
    if (!Number.isInteger(claims.userId) || claims.userId <= 0)
      throw new Error('令牌无效');
    if (expectedType === 'session' && (!Number.isInteger(claims.roleId) || claims.roleId <= 0))
      throw new Error('令牌无效');
    if (!Number.isFinite(claims.expiresAt) || claims.expiresAt <= now())
      throw new Error('令牌已过期');

    return expectedType === 'session'
      ? { userId: claims.userId, roleId: claims.roleId }
      : { userId: claims.userId };
  }

  return {
    signPending: userId => sign('pending', userId, undefined, pendingTtlSeconds),
    signSession: (userId, roleId) => sign('session', userId, roleId, sessionTtlSeconds),
    verifyPending: token => verify(token, 'pending'),
    verifySession: token => verify(token, 'session'),
  };
}
