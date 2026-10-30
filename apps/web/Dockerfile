# syntax=docker/dockerfile:1
# Imagen de la web: compila Angular y la sirve con Caddy (HTTPS automático y proxy a la API).
# Se construye desde la raíz del repositorio:
#   docker build -f apps/web/Dockerfile -t nexustrack-web .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY packages/shared packages/shared
RUN npx -y -p typescript@6.0.3 tsc -p packages/shared/tsconfig.json
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc apps/web/
RUN npm --prefix apps/web ci --no-audit --no-fund
COPY apps/web apps/web
RUN npm --prefix apps/web run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist/web/browser /srv
EXPOSE 80 443
