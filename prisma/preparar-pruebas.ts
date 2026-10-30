/**
 * Deja la base de pruebas (DATABASE_URL_TEST) en un estado conocido: migraciones al día,
 * tablas vacías, correlativos en cero y datos iniciales cargados desde el Excel.
 * La usan las pruebas de integración de la API y las pruebas de flujo con Playwright.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TABLAS = [
  'RendicionGasto',
  'RendicionViatico',
  'Rendicion',
  'ValeCombustible',
  'GuiaFlete',
  'OrdenCarga',
  'ValeDinero',
  'OrdenRetiro',
  'Asignacion',
  'RutaTarifa',
  'Conductor',
  'Movil',
  'Packing',
  'Empresa',
  'Cliente',
  'CatalogoItem',
  'Auditoria',
  'Usuario',
  'Parametro',
];

export function prepararBaseDePruebas(): void {
  const url = process.env['DATABASE_URL_TEST'] ?? '';
  if (!url) throw new Error('Falta DATABASE_URL_TEST en el archivo .env.');
  const nombre = new URL(url).pathname.slice(1);
  // Resguardo: nunca vaciar una base que no sea de pruebas.
  if (!nombre.endsWith('_test')) {
    throw new Error(
      `Por seguridad, las pruebas solo corren sobre una base cuyo nombre termine en "_test" (recibido: "${nombre}").`,
    );
  }
  const env = { ...process.env, DATABASE_URL: url };
  const correr = (cmd: string, input?: string) =>
    execSync(cmd, {
      cwd: RAIZ,
      env,
      input,
      stdio: input ? ['pipe', 'pipe', 'inherit'] : ['ignore', 'pipe', 'inherit'],
    });
  correr('npx prisma migrate deploy');
  correr(
    'npx prisma db execute --stdin',
    `TRUNCATE ${TABLAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE; UPDATE "Secuencia" SET "ultimo" = 0;`,
  );
  correr('npx tsx prisma/seed.ts');
}
