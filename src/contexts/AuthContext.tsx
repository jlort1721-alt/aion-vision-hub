import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ── Token Storage ─────────────────────────────────────────

function getStoredAuth(): { token: string; refreshToken: string } | null {
  const token = localStorage.getItem('aion_token');
  const refreshToken = localStorage.getItem('aion_refresh_token');
  return token && refreshToken ? { token, refreshToken } : null;
}

function storeAuth(token: string, refreshToken: string) {
  localStorage.setItem('aion_token', token);
  localStorage.setItem('aion_refresh_token', refreshToken);
}

function clearAuth() {
  localStorage.removeItem('aion_token');
  localStorage.removeItem('aion_refresh_token');
}

// ── Types ─────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string;
  avatarUrl?: string | null;
}

/**
 * Backward-compatible Profile shape so existing consumers
 * that read profile.tenant_id, profile.full_name, etc. keep working.
 */
interface Profile {
  id: string;
  user_id: string;
  tenant_id: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
}

/**
 * Minimal session-like object so hooks that read session.access_token
 * (e.g., use-websocket, use-digital-twin) continue to work.
 */
interface SessionCompat {
  access_token: string;
}

/**
 * Minimal user-like object so consumers that read user.email
 * and user.id continue to work.
 */
interface UserCompat {
  id: string;
  email: string;
}

interface AuthState {
  user: UserCompat | null;
  session: SessionCompat | null;
  profile: Profile | null;
  roles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  refreshToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Helper: build compat objects from user profile ────────

function buildCompatObjects(
  userProfile: UserProfile,
  token: string,
  refreshToken: string,
): Pick<AuthState, 'user' | 'session' | 'profile' | 'roles' | 'token' | 'refreshToken'> {
  return {
    user: { id: userProfile.id, email: userProfile.email },
    session: { access_token: token },
    profile: {
      id: userProfile.id,
      user_id: userProfile.id,
      tenant_id: userProfile.tenantId,
      full_name: userProfile.fullName,
      avatar_url: userProfile.avatarUrl ?? null,
      is_active: true,
    },
    roles: userProfile.role ? [userProfile.role] : [],
    token,
    refreshToken,
  };
}

// ── Provider ──────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    roles: [],
    isAuthenticated: false,
    isLoading: true,
    token: null,
    refreshToken: null,
  });

  // ── Bootstrap: verify stored token on mount ────────────
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = getStoredAuth();
      if (!stored) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
        return;
      }

      try {
        // Try to fetch current user profile with existing token
        const userProfile = await apiClient.get<UserProfile>('/auth/me');

        if (!cancelled) {
          setState({
            ...buildCompatObjects(userProfile, stored.token, stored.refreshToken),
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } catch (err: unknown) {
        // Token invalid — try refresh
        const isUnauthorized =
          err instanceof Error && 'status' in err && (err as unknown as { status: number }).status === 401;

        if (isUnauthorized && stored.refreshToken) {
          try {
            const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: stored.refreshToken }),
            });

            if (resp.ok) {
              const json = await resp.json();
              const data = json.data ?? json;
              const newToken: string = data.accessToken || data.token;
              const newRefreshToken: string = data.refreshToken;
              storeAuth(newToken, newRefreshToken);

              // Re-fetch user with new token
              const userProfile = await apiClient.get<UserProfile>('/auth/me');

              if (!cancelled) {
                setState({
                  ...buildCompatObjects(userProfile, newToken, newRefreshToken),
                  isAuthenticated: true,
                  isLoading: false,
                });
              }
              return;
            }
          } catch {
            // refresh failed — fall through to clear
          }
        }

        // All recovery failed
        clearAuth();
        if (!cancelled) {
          setState({
            user: null,
            session: null,
            profile: null,
            roles: [],
            isAuthenticated: false,
            isLoading: false,
            token: null,
            refreshToken: null,
          });
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const result = await apiClient.post<{ accessToken?: string; token?: string; refreshToken: string; user: UserProfile }>(
      '/auth/login',
      { email, password },
    );

    const token = result.accessToken || result.token || '';
    storeAuth(token, result.refreshToken);

    // Fetch full profile (backend /auth/me may have extra fields)
    let userProfile: UserProfile;
    try {
      userProfile = await apiClient.get<UserProfile>('/auth/me');
    } catch {
      userProfile = result.user;
    }

    setState({
      ...buildCompatObjects(userProfile, token, result.refreshToken),
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ── Signup / Register ──────────────────────────────────
  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    const result = await apiClient.post<{ accessToken?: string; token?: string; refreshToken: string; user: UserProfile }>(
      '/auth/register',
      { email, password, fullName },
    );

    const signupToken = result.accessToken || result.token || '';
    storeAuth(signupToken, result.refreshToken);

    setState({
      ...buildCompatObjects(result.user, signupToken, result.refreshToken),
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ── Logout ─────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearAuth();
    setState({
      user: null,
      session: null,
      profile: null,
      roles: [],
      isAuthenticated: false,
      isLoading: false,
      token: null,
      refreshToken: null,
    });
  }, []);

  // ── Reset Password (request email) ────────────────────
  const resetPassword = useCallback(async (email: string) => {
    await apiClient.post('/auth/reset-password', { email });
  }, []);

  // ── Update Password (confirm reset) ───────────────────
  const updatePassword = useCallback(async (password: string) => {
    // The reset token is expected to be in the URL search params
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token') || '';
    await apiClient.post('/auth/reset-password/confirm', { token: resetToken, newPassword: password });
  }, []);

  // ── Role helpers ───────────────────────────────────────
  const hasRole = useCallback((role: string) => state.roles.includes(role), [state.roles]);
  const hasAnyRole = useCallback(
    (roles: string[]) => roles.some((r) => state.roles.includes(r)),
    [state.roles],
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        resetPassword,
        updatePassword,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
