import { describe, expect, it } from 'vitest';
import { SessionStore } from './session.store';

describe('SessionStore', () => {
  it('accepts and clears an authenticated session', () => {
    const store = new SessionStore();

    store.setSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        username: 'admin',
        displayName: 'Subscription Admin',
        role: 'SUPER_ADMIN',
      },
    });

    expect(store.authenticated()).toBe(true);
    expect(store.accessToken).toBe('access-token');
    expect(store.refreshToken).toBe('refresh-token');
    expect(store.user()?.username).toBe('admin');
    expect(store.hasAnyRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
    expect(store.hasAnyRole('OPERATOR')).toBe(false);

    store.clear();

    expect(store.authenticated()).toBe(false);
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.hasAnyRole('SUPER_ADMIN')).toBe(false);
  });
});
