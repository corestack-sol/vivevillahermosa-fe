'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { backendFetch, type BackendUser } from '@/lib/backendApi';

export interface AuthUser {
  userId: string;
  email: string;
  nombre: string;
  rol: string;
  esAdmin?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: backendUser } = await backendFetch<{
        user: BackendUser | null;
      }>('/auth/me');
      setUser(
        backendUser
          ? {
              userId: backendUser.id,
              email: backendUser.email,
              nombre: backendUser.nombre,
              rol: backendUser.rol,
              esAdmin: backendUser.esAdmin,
            }
          : null,
      );
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await backendFetch('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    function cargarSesion() {
      refresh();
    }
    cargarSesion();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
