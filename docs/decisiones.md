# Decisiones técnicas

Registro de las decisiones tomadas al construir NexusTrack que se apartan del plan o que no
son evidentes leyendo el código. Fecha de referencia: 27-10-2026.

## 1. Web en Angular 21 + PrimeNG 21 (y no 22)

PrimeNG 22 (julio de 2026) cambió de licencia MIT a **PrimeUI License**: exige una clave,
gratuita solo para organizaciones con menos de 10 empleados, menos de 5 desarrolladores y
menos de US$ 1 millón de ingresos anuales, y pagada por desarrollador en los demás casos.
Sin clave muestra el aviso "Invalid PrimeUI License" en pantalla.

PrimeNG 21 sigue bajo MIT y requiere Angular 21, que tiene soporte de seguridad (LTS) hasta
mayo de 2027. Se eligió esa combinación para entregar una plataforma sin costos de licencia
ni avisos.

**Cómo pasar a Angular 22 + PrimeNG 22** (cuando se tenga la clave PrimeUI):

1. En `apps/web/package.json`: `@angular/*` a `^22`, `primeng` a `^22`, `@primeuix/themes` a `^3`,
   `typescript` a `~6.0`, `vitest` a `^5`.
2. En `apps/web/src/app/app.config.ts`, agregar la clave: `providePrimeNG({ ..., license: '<clave>' })`
   (leerla de una variable de entorno de build, no dejarla en el repositorio).
3. En `apps/web/src/app/compartido/tabla/tabla-datos.html`, `p-sortIcon` pasa a `p-sorticon`.
4. En PrimeNG 22, `p-table`, `p-avatar`, `p-multiselect` e `p-inputicon` ya no aceptan
   `styleClass`; el código ya usa `class`, que funciona en ambas versiones.

El código fue compilado contra ambas versiones durante la construcción.

## 2. La web es un proyecto npm independiente

La API (NestJS 12) exige TypeScript 6 y Vitest 5; Angular 21 exige TypeScript 5.9 y Vitest 4.
Con npm 10 en un solo workspace, ese conflicto de dependencias "peer" hace fallar la
instalación con un error interno (`Cannot read properties of null (reading 'edgesOut')`).

Por eso `apps/web` tiene su propio `package-lock.json` y consume `@nexustrack/shared` como
dependencia local (`file:../../packages/shared`). `npm run setup` instala ambos. La web usa
`legacy-peer-deps` (archivo `apps/web/.npmrc`) porque una dependencia opcional de Vite pide
Vitest 5; todas las dependencias peer que la web necesita están declaradas explícitamente.

## 3. NestJS 12 en ESM y Prisma 7 con adaptador de PostgreSQL

NestJS 12 genera proyectos ESM: los imports internos llevan extensión `.js`. Prisma 7 usa el
generador `prisma-client` (cliente TypeScript generado en `apps/api/src/generated`, fuera del
repositorio) y el adaptador `@prisma/adapter-pg`; la URL de conexión se configura en
`prisma.config.ts`.

## 4. Lint con oxlint

El proyecto NestJS 12 se genera con oxlint en lugar de ESLint. Se usa la misma herramienta para
todo el repositorio (`.oxlintrc.json`), con reglas ajustadas a los patrones de NestJS, Angular
y Prisma. Formato con Prettier.

## 5. Sesión

- Access token JWT de 15 minutos, solo en memoria del navegador.
- Refresh token en cookie `httpOnly`, `SameSite=Strict`, restringida a `/api/auth`; recargar la
  página no pide ingresar de nuevo.
- Cada usuario tiene `versionToken`: cambiar la contraseña, desactivarlo o cambiar su perfil
  invalida todas sus sesiones.
- Contraseñas con Argon2 (`@node-rs/argon2`, binarios precompilados; el paquete `argon2`
  original no trae binario para Mac Intel). Límite de 10 intentos de ingreso por minuto.

## 6. Reglas de integridad en la base de datos

- Correlativos en la tabla `Secuencia`, incrementados dentro de la misma transacción que crea
  el documento: sin saltos ni duplicados bajo concurrencia (cubierto por una prueba).
- Índices únicos parciales (en la migración inicial): una sola asignación vigente por camión,
  conductor y remolque; una sola orden de carga no anulada por orden de retiro; una sola
  rendición emitida por orden de carga.

## 7. Reglas de negocio que resuelven dudas abiertas

Aplican los supuestos de la sección 2 del plan. Los que cambian el comportamiento visible:

- **Estados.** Orden de retiro: Abierta → Con carga → Cerrada (al rendir); Anulada.
  Orden de carga: Abierta → Rendida; Anulada. Vales y rendiciones: Emitido; Anulado.
  Anular exige anular antes los documentos hijos, y devuelve al padre a su estado anterior.
- **Hoja de ruta.** Se asigna automáticamente la primera vez que una orden de carga se guarda
  con al menos una guía (no hay un paso de "confirmar"). Los listados se ordenan por fecha
  de carga. Una rendición exige que la orden de carga tenga guías.
- **Herencia con copia.** La orden de carga copia las patentes y cada guía copia el texto del
  tramo y el valor unitario; cambios posteriores en mantenedores no alteran documentos emitidos.
- **Tarifas.** Se ofrecen las vigentes a la fecha de carga; las vencidas se pueden mostrar
  con una casilla (las cuatro tarifas de la planilla vencieron el 31-12-2022).
- **RUT.** Se valida el dígito verificador al crear o al cambiar el RUT. Los registros
  importados con RUT erróneo se pueden editar sin corregirlo en ese momento.
- **Tipo de conductor.** Se sugiere Trabajador si la empresa es Socio y Tercero en otro caso.
- **Códigos.** Packings y rutas sin código reciben PK-001… y RT-001… automáticamente.

## 8. Tipos de datos

Montos en pesos como enteros. Litros, numerales de bomba, distancias y cantidades como
números de punto flotante redondeados a 2 decimales en los cálculos. % de comisión como
fracción (0,08 = 8 %). Fechas de negocio como `date` sin hora y horas como texto `HH:mm`.

## 9. Puertos de desarrollo

PostgreSQL en 5442 y API en 3100, porque 5432, 5433 y 3000 estaban ocupados en la máquina
donde se construyó. Se cambian en `.env` y `docker/compose.dev.yml`.

## 10. Web en Firebase Hosting y API en un VPS compartido

La web se publica en Firebase Hosting (proyecto `nexustrack-fletes`) y la API en un VPS que
ya tiene un Caddy de otro proyecto en los puertos 80 y 443. Por eso:

- `docker/compose.vps.yml` no publica puertos: la API se une a la red Docker de ese Caddy, que
  la expone con HTTPS. Base y respaldo quedan en su propia red, aislados del otro proyecto.
- La web recibe la dirección de la API al compilar (`NT_API_URL`, ver
  `apps/web/src/app/nucleo/config.ts`). Sin ella sigue llamando a `/api` en su mismo origen.
- La API habilita CORS para los orígenes de `CORS_ORIGIN`, con credenciales y exponiendo
  `Content-Disposition` para que las descargas conserven su nombre.
- La cookie de sesión acepta `COOKIE_SAMESITE=none` para web y API en sitios distintos.
  Safari bloquea esas cookies; con un subdominio propio para la web se vuelve a `strict`.
- La API confía en proxies de la red privada (`trust proxy`), para que el límite de intentos
  de ingreso se aplique por usuario y no a todos los que pasan por Caddy.
- La imagen de la API se compila en el computador de quien despliega y se sube con
  `docker save | ssh docker load`. El VPS tiene 1 CPU y atiende otro proyecto; compilar ahí lo
  frenaría varios minutos.
- La base se llama `nexustrack-db` en la red interna. La API está en dos redes y en la del Caddy
  ya existe un `db` del otro proyecto: con el nombre genérico podría conectarse a esa base.

## 11. Aviso de versión nueva e importación de listados

- La web compara su versión compilada (`NT_VERSION`) con `version.json`, que Firebase sirve sin
  caché. Para saber si hay cambios sin guardar mira la pantalla, no cada formulario: un formulario
  con cambios queda marcado por Angular (`ng-dirty`) y vuelve a estar limpio al guardar, porque
  las pantallas lo reconstruyen o navegan al documento guardado. Así ninguna pantalla tiene que
  registrarse, y las que editan de otra forma usan la clase `nt-sin-guardar`.
- El aviso bloquea siempre; los cambios sin guardar solo dan un plazo de 10 minutos, una vez.
  Si tras recargar sigue llegando la versión anterior (un caché intermedio), no insiste en esa
  sesión para no dejar a la persona en un ciclo de recargas.
- El importador de listados nunca borra ni vacía datos: la planilla agrega y corrige, pero la
  ficha de la app sigue siendo la fuente para lo que la planilla no trae.

## 12. App móvil en Flutter, dentro del mismo repositorio

- Vive en `apps/movil`, aislada: no es workspace de npm, el lint y Docker la ignoran. Estar en el
  mismo repositorio deja cada cambio de la API junto al de sus pantallas.
- Solo consulta y usa la API tal como está. El token de acceso va en memoria; la cookie de
  renovación, que en la web guarda el navegador, la guarda la app en el almacén cifrado del
  teléfono y la envía al renovar. Así no hizo falta otro mecanismo de sesión en el backend.
- Riverpod para el estado, go_router para la navegación, Dio para la API. Sin reintentos
  automáticos: los errores se muestran con su botón «Reintentar».

## 13. Cuenta del conductor, corrección y eliminación

- El saldo del conductor se calcula al vuelo desde los documentos (`/cuentas-conductores`), sin
  tabla propia: no puede desalinearse de los vales y rendiciones. Por flete: anticipos = vales de
  dinero emitidos de la orden de retiro; rendido = total de la rendición emitida. Resultado =
  anticipos − rendido, como en las planillas del cliente: positivo a favor del conductor (le sobró
  anticipo), negativo en contra (puso dinero propio). Los fletes sin rendición no mueven el saldo;
  sus vales se muestran como anticipos por rendir.
- Los vales de combustible no entran: son combustible cargado, no dinero entregado al conductor.
- Sin movimientos de ajuste: el cliente confirmó (01-11-2026) que no hay devoluciones ni
  transferencias aparte; el saldo se arrastra y se compensa con los anticipos siguientes.
- Eliminar es solo del administrador y va del hijo al padre, como anular, sin borrados en
  cascada: el mensaje dice qué documento bloquea. La auditoría guarda la copia completa, con
  guías, viáticos y gastos. Los correlativos eliminados no se reutilizan.
- El administrador corrige órdenes de retiro cerradas y órdenes de carga rendidas. Los anulados
  no se editan: si sobran, se eliminan.
- La hora usa un campo propio de 24 horas. El `input type="time"` del navegador depende del
  sistema operativo: con formato de 12 horas muestra a. m./p. m. y en Safari no trae selector.
- Si la cabecera de la orden de carga queda sin tramo, se toma el de la primera guía; las órdenes
  emitidas antes sin tramo muestran el de sus guías.
