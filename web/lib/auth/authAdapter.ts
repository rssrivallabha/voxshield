import { AuthSession, LoginCredentials, User, UserRole } from '../../types/auth';
import { apiClient } from '../api/client';
import { AppApiError } from '../api/types';
import { envConfig } from '../config/env';

export interface IAuthAdapter {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  switchRole?(role: UserRole): Promise<AuthSession>;
}

// Dev / Mock Auth Adapter implementation
export class MockAuthAdapter implements IAuthAdapter {
  private STORAGE_KEY = 'voxshield_mock_session';
  private LOGGED_OUT_KEY = 'voxshield_logged_out';

  private defaultUsers: Record<UserRole, User> = {
    operator: {
      id: 'usr_op_01',
      email: 'operator@voxshield.sec',
      name: 'Sarah Connor',
      role: 'operator',
      department: 'SOC Tier 1',
    },
    analyst: {
      id: 'usr_an_01',
      email: 'analyst@voxshield.sec',
      name: 'Alex Vance',
      role: 'analyst',
      department: 'Fraud Investigation Unit',
    },
    admin: {
      id: 'usr_adm_01',
      email: 'admin@voxshield.sec',
      name: 'Chief Security Officer',
      role: 'admin',
      department: 'Executive Security',
    },
    system: {
      id: 'usr_sys_01',
      email: 'system@voxshield.sec',
      name: 'Automated Gateway Agent',
      role: 'system',
      department: 'Infrastructure',
    },
  };

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const role: UserRole = credentials.roleOverride || 'admin';
    const user = this.defaultUsers[role] || this.defaultUsers.admin;

    const session: AuthSession = {
      user,
      token: `mock_jwt_token_${role}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.LOGGED_OUT_KEY);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    }
    return session;
  }

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.LOGGED_OUT_KEY, 'true');
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;

    const raw = localStorage.getItem(this.STORAGE_KEY);
    const isLoggedOut = localStorage.getItem(this.LOGGED_OUT_KEY) === 'true';

    if (!raw) {
      if (isLoggedOut) {
        return null;
      }
      // Initial dev experience auto-logs in as admin
      return this.login({ email: 'admin@voxshield.sec', roleOverride: 'admin' });
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      if (new Date(session.expiresAt) <= new Date()) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  }

  async switchRole(role: UserRole): Promise<AuthSession> {
    return this.login({ email: `${role}@voxshield.sec`, roleOverride: role });
  }
}

// Real API Auth Adapter implementation
export class ApiAuthAdapter implements IAuthAdapter {
  private TOKEN_KEY = 'voxshield_auth_token';

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await apiClient.post<AuthSession>('/auth/login', credentials);
    if (typeof window !== 'undefined' && response.token) {
      localStorage.setItem(this.TOKEN_KEY, response.token);
    }
    return response;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Log or ignore if token already invalidated
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.TOKEN_KEY);
      }
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    try {
      return await apiClient.get<AuthSession>('/auth/me', { authToken: token });
    } catch (err) {
      if (err instanceof AppApiError && err.code === 'AUTHENTICATION_ERROR') {
        localStorage.removeItem(this.TOKEN_KEY);
        return null;
      }
      throw err;
    }
  }
}

export function createAuthAdapter(): IAuthAdapter {
  return envConfig.useMockApi ? new MockAuthAdapter() : new ApiAuthAdapter();
}

export const authAdapter = createAuthAdapter();
