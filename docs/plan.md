# NexusTrack — Plan de construcción

Plan para construir la plataforma descrita en `NexusTrack.md`. Está pensado para
un desarrollador con experiencia en Angular que quiere un resultado profesional
en el menor tiempo posible.

Versiones verificadas en npm el 2026-10-27.

---

## 0. Estado de implementación (27-10-2026)

Las fases 0 a 4 están construidas y probadas. La fase 5 queda para después del uso real.

| Fase | Estado | Dónde verlo |
|---|---|---|
| 0. Base | Hecha | Monorepo, Docker Compose, esquema Prisma, migraciones, carga inicial desde el Excel, login con perfiles, grilla reutilizable |
| 1. Mantenedores | Hecha | Empresas, clientes, packings, móviles, conductores, rutas y tarifas, tablero de asignaciones con historial |
| 2. Orden de retiro | Hecha | Autocompletado en cascada desde la asignación vigente, estados, PDF y Excel, listado por día, rango o mes |
| 3. Carga y vales | Hecha | Orden de carga con guías valorizadas y hoja de ruta, vale de dinero, vale de combustible con cálculo de litros |
| 4. Rendiciones e inicio | Hecha | Rendición con viáticos y otros gastos, panel de inicio con pendientes y vencimientos, pruebas de flujo con Playwright |
| 5. Después del MVP | Pendiente | Liquidación de fleteros, reportes, acceso móvil para conductores, avisos por correo |

Pruebas al cierre: 15 unitarias del paquete compartido, 5 unitarias de la API, 8 unitarias
de la web, 20 de integración de la API con base de datos real y 3 de flujo completo en
navegador. Lint y formato sin observaciones.

**Cambios respecto de este plan**, explicados en [decisiones.md](decisiones.md):

- La web usa **Angular 21 + PrimeNG 21** en lugar de 22: PrimeNG 22 pasó a licencia comercial
  PrimeUI. El código está listo para subir de versión cuando se tenga la clave.
- La web es un **proyecto npm independiente** dentro del repositorio, por un conflicto de
  versiones de TypeScript entre NestJS 12 y Angular 21 que npm 10 no resuelve.
- **oxlint** reemplaza a ESLint (es lo que trae NestJS 12).
- La **hoja de ruta** se asigna sola al guardar las primeras guías, sin paso de confirmación.

---

## 1. Resumen

- **Qué se construye:** una aplicación web interna para gestionar fletes:
  7 mantenedores, 14 catálogos y 5 documentos operativos encadenados, con
  exportación a PDF y Excel y listados filtrables por fecha.
- **Stack:** Angular 22 + PrimeNG 22 en el navegador, NestJS 12 + Prisma 7 como
  API, PostgreSQL 17 como base de datos, todo en TypeScript y en Docker.
- **Tiempo estimado:** 9 semanas para un MVP completo (fases 0 a 4) con una
  persona a tiempo completo. Fase 5 queda para después del uso real.
- **Las dudas abiertas no bloquean.** Cada una tiene un supuesto por defecto
  que se puede cambiar sin rehacer el sistema (sección 2).

---

## 2. ¿Se puede construir con las dudas pendientes?

Sí. Ninguna de las dudas afecta la estructura de la base de datos ni el flujo
entre documentos. Se construye con los supuestos de abajo, se dejan como
configuración o campo editable, y se confirman con operaciones al cerrar cada
fase.

| Duda | Supuesto por defecto | Impacto si cambia | Confirmar en |
|---|---|---|---|
| "Tipo Empresa" en Móviles | Se deriva automáticamente de la categoría de la empresa; no se digita. | Se agrega un campo editable. 1 hora. | Fase 1 |
| "PLATADORMA" en Unidades de Rutas | Se corrige a PLATAFORMA al cargar los catálogos. | Ninguno. | Fase 0 |
| Código Packing y Código Ruta vacíos | El sistema propone un código correlativo (PK-001, RT-001) y permite editarlo. | Se cambia la regla de generación. 1 hora. | Fase 1 |
| "Tipo" en Conductores (TRABAJADOR / TERCERO) | Se sugiere TRABAJADOR si la empresa es SOCIO y TERCERO si es FLETERO o EXTERNO; siempre editable. | Se quita la sugerencia. Minutos. | Fase 1 |
| Doble campo "Destino" en Orden de Retiro | Dos campos: Destino (ciudad del catálogo) y Destino final (texto libre, por ejemplo terminal o consignatario). | Se renombra o se oculta uno. Minutos. | Fase 2 |
| Significado de "MTB" | Campo de texto libre con esa etiqueta. | Se cambia la etiqueta o el tipo de dato. Minutos. | Fase 2 |
| Qué es una orden "activa" | Orden de Retiro: ABIERTA, CON CARGA, CERRADA, ANULADA. Orden de Carga: ABIERTA, RENDIDA, ANULADA. "Activa" es toda orden que no está CERRADA ni ANULADA. | Se agregan o renombran estados. Medio día. | Fase 2 |
| N° Hoja de Ruta por orden o por guía | Un número por orden de carga, asignado al confirmar sus guías; los listados se ordenan por fecha de carga. | Se mueve el número a la guía. Medio día. | Fase 3 |
| Rendiciones sin total general ni exportación | Se incluye total general (peajes + carga + descarga + viáticos + otros gastos), PDF, Excel y listado, igual que los demás documentos. | Si no lo quieren, se oculta. Minutos. | Fase 4 |
| Patentes en Vale Combustible | Se heredan de la Orden de Retiro y se pueden modificar. | Ninguno. | Fase 3 |
| Espacios finales en catálogos | Se limpian al cargar. | Ninguno. | Fase 0 |

Hay otras definiciones que la planilla no menciona y que también se resuelven
con un valor por defecto:

| Tema | Supuesto por defecto |
|---|---|
| Usuarios y roles | Administrador, Operaciones, Finanzas, Solo lectura. Un rol Conductor se agrega en fase 5. |
| Numeración de documentos | Correlativo por tipo de documento, sin prefijo y sin reinicio anual. |
| Moneda y formatos | Pesos chilenos sin decimales, fechas dd/mm/aaaa, zona horaria America/Santiago, RUT validado con módulo 11. |
| Idioma | Español de Chile en toda la interfaz. |
| Hosting | Un servidor Linux con Docker. Se puede cambiar a nube administrada sin tocar el código. |

---

## 3. Stack recomendado y por qué

Conoces Angular. NestJS es el framework de servidor que copia la arquitectura de
Angular (módulos, inyección de dependencias, decoradores, guards, pipes), así
que puedes ser productivo en la API desde el primer día. Es la combinación más
rápida para ti y es un stack profesional y vigente.

Next.js es una buena opción, pero implica aprender React, su modelo de
renderizado en servidor y un ecosistema distinto. No aporta nada que este
proyecto necesite y sí te costaría semanas de curva de aprendizaje.

| Capa | Herramienta | Versión | Para qué |
|---|---|---|---|
| Frontend | Angular (standalone components, signals) | 21.2 (ver sección 0) | Interfaz, formularios reactivos, enrutamiento. |
| Componentes UI | PrimeNG | 21.1 (ver sección 0) | Tabla con orden, filtros por columna, paginación y exportación; autocompletados; calendarios; diálogos. Es la pieza que resuelve "como en Excel". |
| API | NestJS | 12.2 | REST, validación, autenticación, roles, generación de PDF y Excel. |
| ORM y migraciones | Prisma | 7.10 (estable; la 8 está en candidata) | Modelo tipado, migraciones versionadas, seed inicial desde el Excel. |
| Base de datos | PostgreSQL | 17 | Transacciones, secuencias, integridad referencial. |
| Autenticación | Passport + JWT en NestJS | — | Login con usuarios locales, tokens cortos, roles por guard. |
| Documentación API | Swagger (OpenAPI) vía NestJS | — | Contrato visible y probable desde el navegador. |
| Excel | ExcelJS | 4.4 | Exportación de documentos y listados. |
| PDF | Puppeteer (HTML a PDF con Chromium) | 25 | Documentos imprimibles desde plantillas HTML con el mismo estilo de la web. |
| Pruebas | Jest (API), Vitest o Jest (web), Playwright (flujos completos) | — | Reglas de negocio y flujos críticos. |
| Infra | Docker Compose, Caddy o Nginx, GitHub Actions | — | Entorno local idéntico a producción, HTTPS automático, CI. |

Notas:

- La versión de TypeScript la fija el CLI de Angular; no se instala aparte.
- Nx es opcional. Para una persona, un monorepo simple con npm workspaces basta y
  evita curva de aprendizaje.
- Tu máquina ya tiene Node 22, npm 10, Docker 24 y git. Falta solo un
  PostgreSQL, que se levanta con Docker.

---

## 4. Arquitectura

```
Navegador ── Angular 22 + PrimeNG (SPA)
                │  HTTPS / JSON, JWT en cabecera
                ▼
API NestJS 12 ── módulos: auth, catalogos, empresas, clientes, packings,
                │         moviles, conductores, asignaciones, rutas-tarifas,
                │         ordenes-retiro, vales-dinero, ordenes-carga,
                │         vales-combustible, rendiciones, reportes, exportacion
                │  Prisma
                ▼
PostgreSQL 17 ── tablas + secuencias + auditoría
```

Estructura del repositorio:

```
nexustrack/
├── apps/
│   ├── web/          Angular
│   └── api/          NestJS
├── packages/
│   └── shared/       tipos y DTOs compartidos (TypeScript), validadores de RUT, formatos
├── prisma/           schema.prisma, migraciones, seed desde NexusTrack.xlsx
├── docker/           compose para desarrollo y producción
├── docs/             NexusTrack.md, plan.md, decisiones
└── .github/workflows CI: lint, pruebas, build
```

Principios:

- **Toda regla de negocio vive en la API.** El navegador muestra y valida
  formato; los correlativos, estados, cálculos y herencias se ejecutan en el
  servidor dentro de transacciones.
- **Un componente de grilla reutilizable** sobre la tabla de PrimeNG, con
  búsqueda global, filtros por columna, orden, selección de columnas y botones
  de exportar. Lo usan los 7 mantenedores y los 5 listados de documentos.
- **Un componente de formulario de documento** con cabecera heredada del padre,
  campos propios y acciones (guardar, anular, PDF, Excel, crear hijo).
- **Contratos tipados de punta a punta.** Los DTOs viven en `packages/shared`
  y los usan tanto Angular como NestJS.

---

## 5. Modelo de datos

### Catálogos

Una tabla `catalogo_item` con `tipo`, `valor`, `orden`, `activo`. Tipos:
CIUDAD, PUERTO_EMBARQUE, DEPOSITO, TRAZABILIDAD, TIPO_MOVIL, CATEGORIA_EMPRESA,
UNIDAD_RUTA, ESPECIE, UM_ESPECIE, UM_TARIFA, SITIO_ENTREGA, FORMA_PAGO,
TIPO_DOCUMENTO, ITEM_GASTO.

Los valores que afectan lógica (CAMION, TRACTOCAMION, CHASIS, THERMO,
PLATAFORMA, SOCIO, FLETERO, EXTERNO) llevan además un `codigo` fijo para que el
código no dependa del texto.

### Mantenedores

| Tabla | Campos principales | Relaciones |
|---|---|---|
| empresa | rut (único), razón social, activo, propietario, fono, email | categoría → catálogo |
| cliente | rut (único), nombre, activo, giro, dirección, contacto operaciones, contacto administrativo, fono, email | — |
| packing | código, nombre, ubicación | cliente |
| movil | patente (única), marca, modelo, año, activo, vencimientos de revisión técnica, permiso de circulación y seguro | tipo → catálogo, empresa |
| conductor | rut (único), nombre, activo, tipo (TRABAJADOR / TERCERO), % comisión, n° licencia, vencimiento licencia, fecha ingreso, término contrato, dirección, teléfono, n° cuenta, banco | empresa |
| asignacion | fecha asignación, vigente desde, vigente hasta (nulo = vigente) | empresa, camión → movil, conductor, chasis → movil, thermo → movil, plataforma → movil |
| ruta_tarifa | código, tramo (generado "ORIGEN - DESTINO - UNIDAD"), distancia km, valor, vigencia desde, vigencia hasta | cliente, origen y destino → catálogo CIUDAD, unidad → catálogo UNIDAD_RUTA |

### Documentos operativos

| Tabla | Campos propios | Relaciones y reglas |
|---|---|---|
| secuencia | tipo de documento, último número | Una fila por tipo; se incrementa dentro de la transacción que crea el documento. |
| orden_retiro | número, fecha, estado, tipo remolque (copiado), fecha y hora de carga, destino final (texto), nave, MTB, booking, fecha y hora de embarque, OP n°, O/C, observaciones | trazabilidad, conductor, camión, remolque, empresa, cliente, origen, destino, depósito retiro, packing carga, depósito entrega, packing entrega, puerto embarque |
| vale_dinero | número, fecha entrega, concepto (defecto FLETE), glosa, monto, estado | orden_retiro, sitio entrega, forma de pago |
| orden_carga | número, estado, n° hoja de ruta, total neto guías | orden_retiro (única), tramo → ruta_tarifa |
| guia_flete | n° guía, fecha, cantidad especie, n° contenedor, cantidad tarifa, valor unitario (copiado de la tarifa), total (calculado) | orden_carga, especie, UM especie, tramo/tarifa → ruta_tarifa, UM tarifa |
| vale_combustible | número, fecha y hora de entrega, numerales inicial y final de camión y remolque, valor litro, litros y totales calculados, estado | orden_retiro, sitio entrega, forma de pago, tipo documento, camión, remolque |
| rendicion | número, fecha, fechas y horas de salida y llegada, odómetros, km (calculado), peajes, carga, descarga, observaciones, fecha entrega, totales, estado | orden_carga (única), sitio entrega |
| rendicion_viatico | fecha, desayuno, almuerzo, comida, total (calculado) | rendicion |
| rendicion_gasto | n° documento, rut proveedor, fecha, monto, observaciones | rendicion, tipo documento, ítem gasto |

### Transversales

| Tabla | Para qué |
|---|---|
| usuario | email, nombre, hash de contraseña, rol, activo |
| auditoria | entidad, id, acción, usuario, fecha, cambios en JSON. Toda tabla lleva además creado por / en y modificado por / en. |

---

## 6. Reglas de negocio

1. **Correlativos.** La API toma el siguiente número de `secuencia` con bloqueo
   de fila y crea el documento en la misma transacción. Sin saltos ni
   duplicados con varios usuarios.
2. **Estados.** Orden de Retiro pasa a CON CARGA al crearse su orden de carga y
   a CERRADA cuando se rinde. ANULADA requiere rol Administrador y motivo. Solo
   las órdenes activas aparecen al crear documentos hijos.
3. **Herencia con copia.** Los hijos referencian al padre y copian los datos
   que fijan su valor: patentes, tipo de remolque, valor unitario del tramo.
   Cambios posteriores en mantenedores no alteran documentos emitidos.
4. **Autocompletado editable.** Al elegir conductor, la API responde empresa,
   camión y remolque desde la asignación vigente; el formulario los precarga y
   permite cambiarlos. Al elegir tramo, precarga valor unitario y unidad.
5. **Tramos por cliente.** En Orden de Carga solo se ofrecen las rutas tarifa
   del cliente de la orden de retiro, vigentes a la fecha de carga.
6. **Cálculos en servidor.** Total de guía, total neto, litros, total
   combustible, kilómetros, totales de viáticos y gastos. El navegador los
   muestra en vivo pero el valor guardado es el que calcula la API.
7. **Hoja de ruta.** Al confirmar las guías de una orden de carga se asigna el
   siguiente número de hoja de ruta. Los listados ordenan por fecha de carga.
8. **Validaciones.** RUT con módulo 11 y único por tabla, patente única,
   vencimientos como fechas, montos enteros en pesos, fechas de vigencia
   coherentes, una sola asignación vigente por camión y por conductor.
9. **Catálogos sin borrado.** Un valor de catálogo se desactiva, nunca se
   elimina, para no romper documentos históricos.
10. **Auditoría.** Toda creación, edición y anulación de documentos queda
    registrada con usuario, fecha y cambios.

---

## 7. Módulos y pantallas

| Módulo | Pantallas |
|---|---|
| Acceso | Login, cambio de contraseña, administración de usuarios y roles. |
| Catálogos | Una pantalla por tipo con agregar, editar, reordenar y desactivar. |
| Mantenedores | Para cada uno: listado con grilla (buscar, filtrar, ordenar, exportar) y formulario de alta/edición. Móviles y Conductores muestran vencimientos con semáforo. |
| Asignaciones | Tablero por camión con su conductor y remolques vigentes, cambio rápido de chasis por thermo, historial. |
| Orden de Retiro | Formulario con autocompletado en cascada; listado con filtros por día, rango y mes; PDF; Excel; botones "Crear vale de dinero", "Crear orden de carga", "Crear vale de combustible". |
| Vale de Dinero | Selección de orden activa, formulario, listado, PDF, Excel. |
| Orden de Carga | Selección de orden activa sin carga, cabecera heredada, tramo del cliente, grilla de guías con totales, hoja de ruta, listado, PDF, Excel, botón "Crear rendición". |
| Vale de Combustible | Selección de orden activa, numerales por unidad, cálculo de litros y total, listado, PDF, Excel. |
| Rendiciones | Selección de orden de carga activa, datos del viaje, gastos, viáticos, otros gastos, totales, listado, PDF, Excel. |
| Inicio | Órdenes abiertas, pendientes de carga, pendientes de rendición, vencimientos próximos de móviles y licencias. |
| Reportes (fase 5) | Fletes por cliente y período, liquidación por fletero según % comisión, consumo de combustible por móvil. |

---

## 8. Fases y entregables

Estimación para una persona a tiempo completo.

| Fase | Semanas | Entregables | Criterio de cierre |
|---|---|---|---|
| 0. Base | 1 | Repositorio, Docker Compose con PostgreSQL, API y web vacías corriendo, esquema Prisma completo, migración inicial, seed desde NexusTrack.xlsx, login con roles, CI con lint y pruebas, componente de grilla. | Un usuario inicia sesión y ve los 14 catálogos cargados en una grilla. |
| 1. Mantenedores | 2 | Empresas, Clientes, Packings, Móviles, Conductores, Rutas Tarifas, Asignaciones con grilla y formularios; tablero de asignaciones; validación de RUT y patente. | Operaciones puede mantener todo el maestro sin usar Excel. |
| 2. Orden de Retiro | 2 | Formulario con autocompletado en cascada, correlativo, estados, listado con filtros de fecha, PDF y Excel del documento y del listado, auditoría. | Se emite una orden real y se imprime. |
| 3. Carga y vales | 2 | Orden de Carga con guías, totales y hoja de ruta; Vale de Dinero; Vale de Combustible; sus listados y exportaciones. | Un flete completo queda documentado de punta a punta. |
| 4. Rendiciones e inicio | 2 | Rendiciones con viáticos y otros gastos; panel de inicio con pendientes y vencimientos; pruebas de flujo completo con Playwright; manual breve de usuario. | MVP en producción con usuarios reales. |
| 5. Después del MVP | según prioridad | Liquidación de fleteros, reportes, acceso móvil para conductores, notificaciones de vencimientos por correo. | Se define con el uso real. |

Cada fase termina con una revisión con operaciones donde se confirman los
supuestos de la sección 2 que le corresponden.

---

## 9. Estándares de calidad

- **Código:** ESLint y Prettier en ambos proyectos, commits convencionales,
  revisión por pull request aunque trabajes solo (deja historia legible).
- **Pruebas:** unitarias para reglas de negocio (correlativos, estados,
  cálculos, validación de RUT), de integración para cada endpoint con base de
  datos real en Docker, y de flujo completo con Playwright para el camino
  orden de retiro a rendición.
- **Migraciones versionadas** con Prisma; nunca se altera la base a mano.
- **Seguridad:** contraseñas con argon2, JWT de corta duración con refresh,
  guards por rol en cada endpoint, validación de todos los DTOs, límites de
  tasa en login, cabeceras seguras, HTTPS obligatorio.
- **Datos:** respaldo diario de PostgreSQL con retención de 30 días y prueba de
  restauración al menos una vez antes de salir a producción.
- **Observabilidad:** logs estructurados en la API, registro de errores,
  endpoint de salud para el monitoreo.
- **Interfaz:** responsive desde 360 px, accesible por teclado, textos en
  español de Chile, formatos chilenos de RUT, moneda y fecha.
- **Documentación:** README con puesta en marcha en 5 comandos, Swagger
  siempre actualizado, decisiones de arquitectura registradas en `docs/`.

---

## 10. Infraestructura y despliegue

| Entorno | Dónde | Cómo |
|---|---|---|
| Desarrollo | Tu máquina | Docker Compose solo para PostgreSQL; API y web en modo desarrollo con recarga. |
| Producción | Un VPS Linux (2 CPU, 4 GB) o un servicio administrado | Docker Compose con PostgreSQL, API, web servida por Caddy con HTTPS automático. Despliegue por GitHub Actions al hacer push a `main`. |
| Respaldos | Mismo servidor y copia externa | pg_dump diario, copia a almacenamiento externo. |

Un entorno de pruebas intermedio se agrega solo si el cliente quiere validar
antes de cada versión.

---

## 11. Definiciones que conviene cerrar pronto

Ninguna bloquea el inicio, pero las tres primeras se necesitan antes de la
fase 2.

1. Lista de usuarios iniciales y su rol.
2. Logo, colores y datos legales de la empresa emisora para los PDF.
3. Si los documentos llevan prefijo o reinician numeración cada año.
4. Dónde se alojará el sistema y quién administra el servidor.
5. Las dudas de la sección 2, en el orden de las fases.

---

## 12. Primeros pasos (fase 0)

1. Crear el repositorio con la estructura de la sección 4.
2. Levantar PostgreSQL 17 con Docker Compose.
3. Crear la API con el CLI de NestJS y la web con el CLI de Angular, ambas en
   `apps/`.
4. Escribir `schema.prisma` con el modelo de la sección 5 y generar la primera
   migración.
5. Escribir el seed que lee `NexusTrack.xlsx` y carga catálogos, empresas,
   clientes, packings, móviles, conductores, asignaciones y rutas tarifas.
6. Implementar login, roles y el componente de grilla.
7. Configurar ESLint, Prettier, pruebas y CI.

Al terminar la fase 0 el proyecto ya tiene la forma final; el resto es agregar
módulos sobre la misma base.
