# Despliegue: web en Firebase y API en el VPS

Arquitectura en producción:

- **Web**: Firebase Hosting, proyecto `nexustrack-fletes`, en https://nexustrack-fletes.web.app.
- **API, base de datos y respaldo**: el VPS, con Docker Compose (`docker/compose.vps.yml`).
  El Caddy que ya corre en el VPS para el otro proyecto publica la API con HTTPS.

## Instalación actual (27/10/2026)

| Pieza                    | Dónde                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Web                      | https://nexustrack-fletes.web.app                                           |
| API                      | https://nexustrack-api.2-25-132-42.sslip.io (documentación en `/api/docs`)  |
| VPS                      | `root@2.25.132.42` (srv1704264.hstgr.cloud), carpeta `/opt/nexustrack`      |
| Caddy                    | `track-caddy` del proyecto track-gps, red `track-gps_default`               |
| Caddyfile                | `/opt/track-gps/Caddyfile`, con el bloque de NexusTrack al final            |
| Caddyfile antes del alta | `/opt/track-gps/Caddyfile.antes-de-nexustrack-20261027-1816`                |
| Administrador inicial    | `admin@nexustrack.cl`, clave en `SEED_ADMIN_PASSWORD` de `.env.vps` del VPS |

```bash
VPS=root@2.25.132.42 npm run deploy:api
NT_API_URL=https://nexustrack-api.2-25-132-42.sslip.io npm run deploy:web
```

El resto de esta guía explica cómo se hizo, para repetirlo en otro servidor.

## 1. Dominio para la API

Cree un registro DNS tipo A que apunte a la IP del VPS, por ejemplo
`api.nexustrack.midominio.cl`. Caddy obtiene el certificado HTTPS solo.

Si no tiene un dominio disponible, sirve `nexustrack-api.<IP-con-guiones>.sslip.io`
(por ejemplo `nexustrack-api.203-0-113-10.sslip.io`), que resuelve a esa IP sin configurar DNS.

## 2. Preparar el VPS (una vez)

Conectado al VPS:

```bash
# Red Docker del Caddy existente: va en RED_PROXY
docker inspect track-caddy --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# Dónde está su Caddyfile en el servidor
docker inspect track-caddy --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

mkdir -p /opt/nexustrack
```

Cree `/opt/nexustrack/.env.vps` a partir de `.env.vps.example` y complete los secretos
(`openssl rand -base64 48`), `RED_PROXY` y la clave del administrador.

## 3. Subir y levantar la API

Desde su computador, en la carpeta del proyecto:

```bash
VPS=root@IP_DEL_VPS npm run deploy:api
```

Compila la imagen de la API en su computador (requiere Docker), la sube al VPS y levanta base,
API y respaldo. Así la compilación no ocupa la CPU del VPS, que atiende otros proyectos. La API
aplica las migraciones al arrancar. La primera vez, cargue los datos iniciales desde la planilla
original, que no va en la imagen ni en el repositorio:

```bash
scp NexusTrack.xlsx root@IP_DEL_VPS:/tmp/
ssh root@IP_DEL_VPS "cd /opt/nexustrack && docker compose -f docker/compose.vps.yml --env-file .env.vps cp /tmp/NexusTrack.xlsx api:/tmp/ && docker compose -f docker/compose.vps.yml --env-file .env.vps exec -e SEED_XLSX=/tmp/NexusTrack.xlsx api npx prisma db seed && rm /tmp/NexusTrack.xlsx"
```

## 4. Publicar la API en el Caddy existente

Agregue al Caddyfile del Caddy existente el bloque de `docker/caddy-nexustrack.caddy`, con su
dominio. El Caddyfile está montado como archivo suelto: agréguelo al final con `cat >>` y no con
`sed -i` ni editores que reemplazan el archivo, porque el contenedor seguiría viendo el anterior.
Valide antes de recargar, para no afectar al otro proyecto si hay un error:

```bash
cp Caddyfile Caddyfile.antes-de-nexustrack
cat >> Caddyfile < caddy-nexustrack.caddy
docker exec track-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec track-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
curl https://api.nexustrack.midominio.cl/api/salud
```

`caddy reload` aplica el cambio sin cortar las conexiones del otro proyecto, y si la
configuración es inválida la rechaza y deja la anterior funcionando.

## 5. Apuntar la web a la API

```bash
NT_API_URL=https://api.nexustrack.midominio.cl npm run deploy:web
```

## Actualizaciones

- API: `VPS=root@IP_DEL_VPS npm run deploy:api` (aplica migraciones nuevas al reiniciar).
- Web: `NT_API_URL=https://api.nexustrack.midominio.cl npm run deploy:web`.

## Aviso de versión nueva

Cada `npm run deploy:web` marca la compilación con un número de versión y lo publica en
`version.json`. La web abierta lo revisa cada 5 minutos, al volver a la pestaña y al cambiar de
pantalla. Si hay una versión nueva, muestra un aviso que bloquea la pantalla hasta actualizar.
Si la persona tiene un formulario con cambios sin guardar, puede elegir «Guardar primero»: tiene
10 minutos, con una franja que lo recuerda, y el aviso vuelve a bloquear apenas guarda o al
vencer el plazo. También aparece si una pantalla falla al abrir porque su código ya cambió.

Al pie del menú se ve la versión publicada, por ejemplo **v1.7 · ed4ac12**: el número es
1.<cantidad de commits> y sube solo con cada cambio; el código es el commit de GitHub. Al pasar
el mouse se ve la fecha de publicación. Sirve para saber qué versión tiene un usuario y comparar
en GitHub qué le falta. Si se publica con cambios sin commit, el código lleva un `*`.

Las pantallas que editan sin formulario (como Parámetros) marcan lo pendiente con la clase
`nt-sin-guardar` para que el aviso lo detecte.

## Importar listados de conductores y equipos

`prisma/importar-listado.ts` carga o actualiza Móviles, Conductores y Asignaciones desde una
planilla con las hojas Moviles, Conductores y Asignaciones. Primero simula y muestra qué crearía,
qué cambiaría campo por campo y las advertencias; con `--aplicar` guarda todo en una sola
transacción. Nunca borra: una celda vacía no borra un dato y lo que falta en la planilla queda
igual. Cada cambio queda en la auditoría.

```bash
scp listado.xlsx root@2.25.132.42:/tmp/listado.xlsx
ssh root@2.25.132.42
cd /opt/nexustrack
alias dc='docker compose -f docker/compose.vps.yml --env-file .env.vps'
docker cp /tmp/listado.xlsx "$(dc ps -q api)":/tmp/listado.xlsx
dc exec api npx tsx prisma/importar-listado.ts /tmp/listado.xlsx            # simulación
dc exec api npx tsx prisma/importar-listado.ts /tmp/listado.xlsx --aplicar  # guarda
dc exec api rm /tmp/listado.xlsx && rm /tmp/listado.xlsx
```

Respalde la base antes de aplicar (ver Respaldos).

## Sesión y navegadores

Con la web en `web.app` y la API en su dominio, son sitios distintos: la cookie de sesión usa
`COOKIE_SAMESITE=none`. Safari bloquea esas cookies de terceros, así que en iPhone y Mac con
Safari habrá que volver a ingresar al recargar la página. Para evitarlo, conecte un subdominio
propio a Firebase Hosting (por ejemplo `nexustrack.midominio.cl`, desde la consola de Firebase,
Hosting, "Agregar dominio personalizado"), agréguelo a `CORS_ORIGIN` y cambie
`COOKIE_SAMESITE=strict`: web y API quedan en el mismo sitio.

## Respaldos

El servicio `respaldo` guarda un `pg_dump` diario por 30 días en el volumen
`nexustrack_respaldos`. Para un respaldo en el momento (por ejemplo, antes de importar):

```bash
dc exec respaldo sh -c 'pg_dump -h nexustrack-db -U nexustrack -d nexustrack --no-owner | gzip > /respaldos/nexustrack-manual-$(date +%Y-%m-%d_%H%M).sql.gz'
```

Los respaldos están en el mismo VPS: cópielos fuera de él periódicamente.

```bash
ssh root@2.25.132.42 "docker run --rm -v nexustrack_respaldos:/r alpine ls -lh /r"
```
