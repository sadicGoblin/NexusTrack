#!/usr/bin/env sh
# Compila la web en modo producción y la publica en Firebase Hosting.
#
#   NT_API_URL=https://api.midominio.cl ./scripts/desplegar-web.sh
#
# NT_API_URL es la dirección pública de la API (sin /api al final). Si se omite, la web
# llama a /api en su mismo dominio, lo que solo sirve si un proxy la atiende ahí.
#
# Cada publicación lleva un número de versión (NT_VERSION) y lo deja en version.json: quien
# tenga la web abierta con una versión anterior recibe el aviso de actualizar.
set -eu
cd "$(dirname "$0")/.."

VERSION_WEB="$(date -u +%Y%m%d%H%M%S)"
npm run build:shared
if [ -n "${NT_API_URL:-}" ]; then
  echo "Compilando la versión ${VERSION_WEB} contra la API ${NT_API_URL}"
  npm --prefix apps/web run build -- --define "NT_VERSION='${VERSION_WEB}'" --define "NT_API_URL='${NT_API_URL}'"
else
  echo "Aviso: NT_API_URL no está definida; la web buscará la API en su mismo dominio."
  npm --prefix apps/web run build -- --define "NT_VERSION='${VERSION_WEB}'"
fi
printf '{"version":"%s"}\n' "$VERSION_WEB" > apps/web/dist/web/browser/version.json
npx -y firebase-tools@14 deploy --only hosting --project "${FIREBASE_PROYECTO:-nexustrack-fletes}"
