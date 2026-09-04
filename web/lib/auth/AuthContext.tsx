'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthSession, LoginCredentials, User, UserRole } from '../../types/auth';
import { authAdapter, MockAuthAdapter } from './authAdapter';
import { configureApiClient } from '../api/client';

interface AuthContextValue {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize API client hooks for token & 401
  useEffect(() => {
    configureApiClient({
      getAuthToken: () => {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem('voxshield_mock_session');
        if (raw) {
          try { return JSON.parse(raw).token; } catch { return null; }
        }
        return localStorage.getItem('voxshield_auth_token');
      },
      onUnauthorized: () => {
        setSession(null);
      },
    });
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentSession = await authAdapter.getCurrentSession();
      setSession(currentSession);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const newSession = await authAdapter.login(credentials);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authAdapter.logout();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    setIsLoading(true);
    try {
      if (authAdapter instanceof MockAuthAdapter) {
        const newSession = await authAdapter.switchRole(role);
        setSession(newSession);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      session,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      login,
      logout,
      switchRole,
    }),
    [session, isLoading, login, logout, switchRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
