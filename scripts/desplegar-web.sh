#!/usr/bin/env sh
# Compila la web en modo producción y la publica en Firebase Hosting.
#
#   NT_API_URL=https://api.midominio.cl ./scripts/desplegar-web.sh
#
# NT_API_URL es la dirección pública de la API (sin /api al final). Si se omite, la web
# llama a /api en su mismo dominio, lo que solo sirve si un proxy la atiende ahí.
#
# Cada publicación lleva un número de versión (NT_VERSION) y lo deja en version.json: quien
# tenga la web abierta con una versión anterior recibe el aviso de actualizar. Al pie del menú
# se ve la versión para conversar con el cliente (1.<n° de commits>) y el commit publicado.
set -eu
cd "$(dirname "$0")/.."

VERSION_WEB="$(date -u +%Y%m%d%H%M%S)"
VERSION_APP="1.$(git rev-list --count HEAD)"
COMMIT="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Aviso: hay cambios sin commit; la versión se marca con * (${COMMIT}*)."
  COMMIT="${COMMIT}*"
fi
npm run build:shared
DEFINES="--define NT_VERSION='${VERSION_WEB}' --define NT_VERSION_APP='${VERSION_APP}' --define NT_COMMIT='${COMMIT}'"
if [ -n "${NT_API_URL:-}" ]; then
  echo "Compilando v${VERSION_APP} (${COMMIT}) contra la API ${NT_API_URL}"
  DEFINES="${DEFINES} --define NT_API_URL='${NT_API_URL}'"
else
  echo "Aviso: NT_API_URL no está definida; la web buscará la API en su mismo dominio."
fi
# shellcheck disable=SC2086
npm --prefix apps/web run build -- $DEFINES
printf '{"version":"%s","app":"%s","commit":"%s"}\n' "$VERSION_WEB" "$VERSION_APP" "$COMMIT" \
  > apps/web/dist/web/browser/version.json
npx -y firebase-tools@14 deploy --only hosting --project "${FIREBASE_PROYECTO:-nexustrack-fletes}"
