'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from './ToastContext';

const KEY = 'compareProperties';
export const MAX_COMPARE = 4;

interface CompareContextValue {
  ids: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

function readStored(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    function cargarDesdeStorage() {
      setIds(readStored());
      setHydrated(true);
    }
    cargarDesdeStorage();
  }, []);

  useEffect(() => {
    if (!hydrated) return; // evita pisar localStorage con [] antes de leerlo
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {}
  }, [ids, hydrated]);

  function toggle(id: string) {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        toast.info(`Puedes comparar hasta ${MAX_COMPARE} propiedades a la vez.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function clear() {
    setIds([]);
  }

  const value: CompareContextValue = {
    ids,
    isSelected: (id) => ids.includes(id),
    toggle,
    clear,
  };

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare debe usarse dentro de <CompareProvider>');
  return ctx;
}
