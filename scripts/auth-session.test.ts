import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAuthSession,
  confirmAuthRole,
  getSessionToken,
  readAuthSession,
  readPendingAuth,
  writePendingAuth,
  replacePendingAuthToken,
} from '../src/core/auth-session.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const user = {
  id: 17,
  userName: 'nurse01',
  userRealname: '值班护士',
  token: 'swp-session-token',
  roleList: [
    { id: 3, roleName: '护士' },
    { id: 5, roleName: '护士长' },
  ],
};

test('auth session requires a confirmed role and clears all persisted state', () => {
  const storage = new MemoryStorage();

  assert.equal(readAuthSession(storage), null);
  assert.equal(readPendingAuth(storage), null);
  assert.equal(getSessionToken(storage), '');

  writePendingAuth(user, storage);

  assert.equal(getSessionToken(storage), user.token);
  assert.deepEqual(readPendingAuth(storage), { token: user.token, user });
  assert.equal(readAuthSession(storage), null);

  confirmAuthRole(user.roleList[1], storage);

  assert.deepEqual(readAuthSession(storage), {
    token: user.token,
    user,
    role: user.roleList[1],
  });

  clearAuthSession(storage);

  assert.equal(getSessionToken(storage), '');
  assert.equal(readPendingAuth(storage), null);
  assert.equal(readAuthSession(storage), null);
});

test('writing a new login clears a stale confirmed role', () => {
  const storage = new MemoryStorage();
  writePendingAuth(user, storage);
  confirmAuthRole(user.roleList[0], storage);

  writePendingAuth({ ...user, token: 'new-token' }, storage);

  assert.equal(readAuthSession(storage), null);
  assert.equal(getSessionToken(storage), 'new-token');
});

test('replacing a pending token keeps persisted user and token in sync', () => {
  const storage = new MemoryStorage();
  writePendingAuth(user, storage);

  replacePendingAuthToken('confirmed-token', storage);

  assert.equal(getSessionToken(storage), 'confirmed-token');
  assert.equal(readPendingAuth(storage)?.user.token, 'confirmed-token');
});

test('malformed persisted user data is treated as no session', () => {
  const storage = new MemoryStorage();
  storage.setItem('TokenKey', 'token');
  storage.setItem('DIGITAL_TWIN_AUTH_USER', '{bad-json');
  storage.setItem('DIGITAL_TWIN_AUTH_ROLE', JSON.stringify(user.roleList[0]));

  assert.equal(readPendingAuth(storage), null);
  assert.equal(readAuthSession(storage), null);
});
