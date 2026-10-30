# syntax=docker/dockerfile:1
# Imagen de la API. Se construye desde la raíz del repositorio:
#   docker build -f apps/api/Dockerfile -t nexustrack-api .

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Puppeteer usa el Chromium del sistema (se instala en la etapa final).
ENV PUPPETEER_SKIP_DOWNLOAD=true

FROM base AS build
# URL ficticia: `prisma generate` la exige pero no se conecta.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
# El postinstall genera el cliente Prisma y compila el paquete compartido.
RUN npm ci --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w @nexustrack/api

FROM base AS final
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    TZ=America/Santiago \
    PORT=3100
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app /app
# Planilla de origen para la carga inicial (`npx prisma db seed`).
COPY --chown=node:node docs/NexusTrack.xlsx docs/NexusTrack.xlsx
# Permite limpiar versiones anteriores sin tocar imágenes de otros proyectos.
LABEL org.opencontainers.image.title=nexustrack-api
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica migraciones pendientes y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node apps/api/dist/main.js"]
