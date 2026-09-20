import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, UserRole } from '@workspace/api-client-react';

export type { AuthUser };
export type { UserRole };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAccessDenied: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  login: () => void;
  logout: () => void;
}

function getBasePath() {
  return `${window.location.pathname}${window.location.search}` || '/';
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/user', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          user: AuthUser | null;
          accessAllowed: boolean;
          isAdmin: boolean;
          role: UserRole | null;
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsAccessDenied(Boolean(data.user && data.accessAllowed === false));
          setIsAdmin(Boolean(data.user && data.isAdmin));
          setRole(data.user ? data.role : null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsAccessDenied(false);
          setIsAdmin(false);
          setRole(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAccessDenied,
    isAdmin,
    role,
    login,
    logout,
  };
}
