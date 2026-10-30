import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '../../.env', quiet: true });

/**
 * Pruebas de integración: levantan la app completa contra la base DATABASE_URL_TEST,
 * que se vacía y se vuelve a cargar desde el Excel antes de cada corrida.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/preparar-bd.ts'],
    env: { DATABASE_URL: process.env['DATABASE_URL_TEST'] ?? '', NODE_ENV: 'test' },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
