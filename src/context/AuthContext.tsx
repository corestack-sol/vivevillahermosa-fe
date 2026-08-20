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

  // setUser(null) va en `finally`: si /auth/logout falla (red, 5xx), la
  // sesión local igual se limpia — nunca dejar la UI mostrando "sesión
  // activa" después de que la persona pidió cerrarla (riesgo real en
  // equipo/computadora compartida). El error se relanza para que quien
  // llame a logout() pueda avisar que la sesión del servidor quizás no
  // se cerró del todo.
  const logout = useCallback(async () => {
    try {
      await backendFetch('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    function cargarSesion() {
      refresh();
    }
    cargarSesion();
  }, [refresh]);

  // Re-valida la sesión al volver a esta pestaña — sin esto, cerrar sesión
  // (o que un admin bloquee/degrade la cuenta) en otra pestaña dejaba esta
  // mostrando datos de usuario obsoletos hasta la próxima navegación.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
