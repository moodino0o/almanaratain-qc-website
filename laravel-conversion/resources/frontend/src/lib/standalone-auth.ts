import { useCallback, useEffect, useState } from "react";
import type { AuthUser, UserRole } from "@workspace/api-client-react";

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

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/user", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          user: AuthUser | null;
          accessAllowed: boolean;
          isAdmin: boolean;
          role: UserRole | null;
        }>;
      })
      .then((result) => {
        if (cancelled) return;
        setUser(result.user ?? null);
        setIsAccessDenied(Boolean(result.user && result.accessAllowed === false));
        setIsAdmin(Boolean(result.user && result.isAdmin));
        setRole(result.user ? result.role : null);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setIsAccessDenied(false);
        setIsAdmin(false);
        setRole(null);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.href = "/login";
  }, []);
  const logout = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(returnTo || "/")}`;
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isAccessDenied,
    isAdmin,
    role,
    login,
    logout,
  };
}
