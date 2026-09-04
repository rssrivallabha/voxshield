import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthAdapter } from '../lib/auth/authAdapter';

describe('MockAuthAdapter Session Management', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('login creates a valid session for requested role', async () => {
    const session = await adapter.login({ email: 'analyst@voxshield.sec', roleOverride: 'analyst' });
    expect(session.user.role).toBe('analyst');
    expect(session.token).toContain('mock_jwt_token_analyst');
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('switchRole updates current session', async () => {
    await adapter.login({ email: 'op@voxshield.sec', roleOverride: 'operator' });
    const switched = await adapter.switchRole('admin');
    expect(switched.user.role).toBe('admin');

    const current = await adapter.getCurrentSession();
    expect(current?.user.role).toBe('admin');
  });

  it('logout clears session from storage', async () => {
    await adapter.login({ email: 'op@voxshield.sec', roleOverride: 'operator' });
    await adapter.logout();
    const current = await adapter.getCurrentSession();
    // After explicit logout, getCurrentSession re-initializes dev default if empty or returns null
    // Here we verify logout removed the key
    expect(localStorage.getItem('voxshield_mock_session')).toBeNull();
  });
});
