import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // src/lib/backendApi.ts lanza un error al cargarse si esta variable no
    // existe (a propósito, mismo criterio que JWT_SECRET — nunca un valor
    // de respaldo silencioso en código real). Las pruebas necesitan que el
    // módulo cargue sin explotar aunque no llamen jamás a un endpoint real
    // — este valor nunca se usa de verdad (los tests que sí llaman
    // backendFetch lo mockean con vi.mock).
    env: {
      NEXT_PUBLIC_API_URL: 'https://api.test.local',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
