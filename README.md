# NexusTrack

Plataforma web de gestión de fletes: mantenedores de empresas, clientes, packings, móviles,
conductores, asignaciones y tarifas, y el flujo operativo completo de cada flete
(orden de retiro → orden de carga con guías y hoja de ruta → vales de dinero y combustible →
rendición), con exportación a PDF y Excel.

- Requerimientos funcionales: [docs/NexusTrack.md](docs/NexusTrack.md)
- Plan y estado de construcción: [docs/plan.md](docs/plan.md)
- Decisiones técnicas: [docs/decisiones.md](docs/decisiones.md)

## Stack

| Capa | Tecnología |
|---|---|
| Web | Angular 21 + PrimeNG 21 (MIT), TypeScript 5.9 |
| API | NestJS 12 (ESM) + Prisma 7, TypeScript 6 |
| Base de datos | PostgreSQL 17 |
| Documentos | PDF con Puppeteer (Chromium), Excel con ExcelJS |
| Pruebas | Vitest (unitarias e integración), Playwright (flujo en navegador) |
| Infraestructura | Docker Compose, Caddy (HTTPS automático), GitHub Actions |

PrimeNG 22 pasó a licencia comercial PrimeUI; por eso la web usa Angular 21 + PrimeNG 21,
ambos MIT. El detalle y el camino de actualización están en [docs/decisiones.md](docs/decisiones.md).

## Puesta en marcha (desarrollo)

Requisitos: Node 22.22 o superior y Docker.

```bash
cp .env.example .env          # valores de desarrollo listos para usar
npm run setup                 # dependencias de la API, el paquete compartido y la web
npm run db:up                 # PostgreSQL 17 en Docker (puerto 5442)
npm run db:deploy && npm run db:seed   # tablas + datos iniciales desde docs/NexusTrack.xlsx
npm run dev                   # API en :3100 y web en :4200
```

- Web: http://localhost:4200
- API: http://localhost:3100/api · documentación interactiva: http://localhost:3100/api/docs
- Usuario inicial: `admin@nexustrack.cl` / `Admin123!` (cámbielo en Cambiar contraseña)

Los puertos no son los habituales (5432, 3000) para no chocar con otros servicios de la
máquina; se cambian en `.env` y `docker/compose.dev.yml`.

## Estructura

```
apps/
  api/            NestJS: módulos por recurso, validación, auditoría, PDF/Excel
  web/            Angular: proyecto npm independiente (ver decisiones)
  movil/          Flutter: app de consulta para el personal (ver apps/movil/README.md)
packages/
  shared/         Tipos de la API, enums, permisos, RUT, fechas y cálculos de negocio
prisma/           schema.prisma, migraciones, carga inicial desde el Excel
e2e/              Pruebas de flujo con Playwright
docker/           Compose de desarrollo y producción, Caddyfile
docs/             Requerimientos, plan, decisiones y planilla original
```

## Scripts principales

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web con recarga en vivo |
| `npm run db:up` / `db:down` | Inicia o detiene PostgreSQL de desarrollo |
| `npm run db:migrate` | Crea una migración a partir de cambios en `schema.prisma` |
| `npm run db:deploy` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga o actualiza los datos iniciales desde el Excel (idempotente) |
| `npm run lint` / `format` | oxlint y Prettier |
| `npm test` | Pruebas unitarias (paquete compartido, API y web) |
| `npm run test:e2e` | Pruebas de integración de la API contra la base `nexustrack_test` |
| `npm run test:flujo` | Flujo completo en navegador con Playwright |
| `npm run build` | Compila paquete compartido, API y web |

Las pruebas de integración y de flujo vacían y recargan la base de pruebas
(`DATABASE_URL_TEST`); por seguridad se niegan a correr si su nombre no termina en `_test`.

## Perfiles

| Perfil | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios, catálogos, parámetros, auditoría y anulaciones |
| Operaciones | Mantenedores, órdenes de retiro y de carga, vales y rendiciones |
| Finanzas | Tarifas, vales de dinero y combustible, rendiciones |
| Solo lectura | Consultar y exportar |

## Producción

Despliegue actual: web en Firebase Hosting (https://nexustrack-fletes.web.app) y API en un VPS
junto a otro proyecto. Pasos en [docs/despliegue.md](docs/despliegue.md).

Alternativa con todo en un servidor propio:

```bash
cp .env.produccion.example .env.produccion    # secretos, dominio y clave del administrador
docker compose -f docker/compose.prod.yml --env-file .env.produccion up -d --build
docker compose -f docker/compose.prod.yml --env-file .env.produccion exec api npx prisma db seed
```

Levanta PostgreSQL, la API (aplica migraciones al iniciar), la web servida por Caddy con
certificado HTTPS automático para `DOMINIO`, y un respaldo diario con `pg_dump` que guarda
30 días en el volumen `respaldos`. Copie esos respaldos fuera del servidor y pruebe una
restauración antes de operar en serio:

```bash
gunzip -c nexustrack-AAAA-MM-DD_HHMM.sql.gz | docker compose -f docker/compose.prod.yml exec -T db psql -U nexustrack -d nexustrack
```
