import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbAuth } from '../server/db-auth.mjs';

const secret = 'test-secret-with-at-least-32-characters';

test('database auth signs and verifies pending and session tokens', () => {
  const auth = createDbAuth({ secret, now: () => 1_000 });
  const pending = auth.signPending(17);
  const session = auth.signSession(17, 5);

  assert.deepEqual(auth.verifyPending(pending), { userId: 17 });
  assert.deepEqual(auth.verifySession(session), { userId: 17, roleId: 5 });
  assert.throws(() => auth.verifySession(pending), /令牌类型无效/);
  assert.throws(() => auth.verifyPending(session), /令牌类型无效/);
});

test('database auth rejects expired and tampered tokens', () => {
  let now = 2_000;
  const auth = createDbAuth({
    secret,
    now: () => now,
    pendingTtlSeconds: 5,
    sessionTtlSeconds: 10,
  });
  const pending = auth.signPending(9);
  const session = auth.signSession(9, 3);

  now = 2_006;
  assert.throws(() => auth.verifyPending(pending), /令牌已过期/);
  assert.deepEqual(auth.verifySession(session), { userId: 9, roleId: 3 });

  const last = session.at(-1);
  const tampered = `${session.slice(0, -1)}${last === 'a' ? 'b' : 'a'}`;
  assert.throws(() => auth.verifySession(tampered), /令牌无效/);
});

test('database auth rejects weak secrets and invalid token lifetimes', () => {
  assert.throws(() => createDbAuth({ secret: 'too-short' }), /至少 32 个字符/);
  assert.throws(() => createDbAuth({ secret, pendingTtlSeconds: 0 }), /临时令牌有效期/);
  assert.throws(() => createDbAuth({ secret, sessionTtlSeconds: Number.NaN }), /会话令牌有效期/);
  assert.throws(() => createDbAuth({ secret, sessionTtlSeconds: 7 * 24 * 60 * 60 + 1 }), /会话令牌有效期/);
});
