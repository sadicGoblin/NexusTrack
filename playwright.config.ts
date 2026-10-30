import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de flujo completo en el navegador. Levantan una API y una web aisladas
 * (puertos 3200 y 4300) sobre la base de pruebas, que se vacía y recarga antes de correr.
 * Requiere la API compilada: `npm run test:flujo` la compila primero.
 */
const PUERTO_API = 3200;
const PUERTO_WEB = 4300;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/preparar.ts',
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: `http://localhost:${PUERTO_API}/api/salud`,
      env: {
        PORT: String(PUERTO_API),
        DATABASE_URL: process.env['DATABASE_URL_TEST'] ?? '',
        NODE_ENV: 'test',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx ng serve --port ${PUERTO_WEB} --proxy-config proxy.e2e.json`,
      cwd: 'apps/web',
      url: `http://localhost:${PUERTO_WEB}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
