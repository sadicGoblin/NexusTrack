#!/usr/bin/env sh
# Compila la imagen de la API en este equipo, la sube al VPS y levanta o actualiza la
# API, la base y el respaldo. Compilar aquí evita cargar la CPU del VPS, que atiende
# otros proyectos.
#
#   VPS=root@IP_DEL_VPS ./scripts/desplegar-api-vps.sh
#
# Requiere, en el VPS, el archivo $DESTINO/.env.vps (ver .env.vps.example).
set -eu
: "${VPS:?Defina VPS, por ejemplo VPS=root@203.0.113.10}"
DESTINO="${DESTINO:-/opt/nexustrack}"
IMAGEN=nexustrack-api:latest
cd "$(dirname "$0")/.."

ssh "$VPS" "test -f '$DESTINO/.env.vps'" \
  || { echo "Falta $DESTINO/.env.vps en el VPS (copie .env.vps.example y complételo)"; exit 1; }

docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$IMAGEN" .
echo "Subiendo la imagen al VPS..."
docker save "$IMAGEN" | gzip | ssh "$VPS" 'gunzip | docker load'

ssh "$VPS" "mkdir -p '$DESTINO/docker'"
scp -q docker/compose.vps.yml "$VPS:$DESTINO/docker/compose.vps.yml"
ssh "$VPS" "cd '$DESTINO' \
  && docker compose -f docker/compose.vps.yml --env-file .env.vps up -d --wait \
  && docker compose -f docker/compose.vps.yml --env-file .env.vps ps \
  && docker image prune -f --filter label=org.opencontainers.image.title=nexustrack-api"
