# NexusTrack — Plataforma de Gestión de Transporte

Documento de levantamiento de requerimientos. Transcribe el modelo de datos y los
módulos definidos en la planilla de trabajo original (Excel), hoja por hoja.

**Estado:** 13 hojas transcritas y verificadas contra el archivo fuente
`NexusTrack.xlsx` (misma carpeta): BaseDatos, Empresas, Clientes, Packings,
Móviles, Conductores, Asignaciones, Rutas Tarifas, Orden de Retiro, Vale Dinero,
Orden de Carga, Vale Combustible y Rendiciones.

## Estructura del sistema

| Grupo | Módulos |
|---|---|
| Listas maestras | BaseDatos |
| Mantenedores | Empresas, Clientes, Packings, Móviles, Conductores, Asignaciones, Rutas Tarifas |
| Documentos operativos | Orden de Retiro, Vale Dinero (Anticipo de Viajes), Orden de Carga, Vale Combustible (Orden de Entrega de Combustible), Rendiciones |

## Convenciones

En cada módulo los campos se describen con el tipo de entrada que indica la
planilla:

| Tipo de entrada | Significado |
|---|---|
| Digitar | Texto, número o fecha ingresado manualmente por el usuario. |
| Casilla de Verificación | Checkbox (verdadero / falso). |
| BaseDatos | Selección desde un listado: una tabla de la hoja BaseDatos u otro módulo. |
| Correlativo Automático | Número secuencial generado por el sistema. |
| Cálculo | Valor calculado por el sistema a partir de otros campos. |
| Heredado | Dato que viene del documento padre (por ejemplo la Orden de Retiro) y se muestra sin volver a digitar. |

En el archivo Excel los listados están solo descritos como texto: no hay
validaciones de datos (desplegables) configuradas ni fórmulas.

---

## 1. BaseDatos (listas maestras)

Hoja con las tablas de referencia que alimentan los listados desplegables del
resto de los módulos. Cada tabla tiene una sola columna.

### Tabla13 — CIUDADES

ALHUE, BUIN, CALDERA, CALERA DE TANGO, CHILLAN, CHIMBARONGO, CODEGUA, COLBUN,
COPIAPO, COQUIMBO, CURICO, EL PALQUI, ELQUI, GRANEROS, HIJUELAS, HUIQUE,
LA CAÑA, LAS CABRAS, LINARES, LINDEROS, LONGAVI, LONTUE, LOS ANDES,
LOS GUINDOS, LOS LIRIOS, LOS NICHES, MALLOA, MALVILLA, MOLINA, MONTE PATRIA,
OVALLE, PAINE, PARRAL, PELEQUEN, RANCAGUA, RAPEL, RENGO, REQUINOA, RETIRO,
ROMERAL, ROSARIO, SAGRADA FAMILIA, SAN ALBERTO, SAN ANTONIO, SAN CARLOS,
SAN FELIPE, SAN FERNANDO, SAN FRANCISCO DE MOSTAZAL, SAN JAVIER, SAN RAFAEL,
SAN VICENTE DE TAGUA TAGUA, SANTA INES, SANTIAGO, TALCA, TENO, TUNICHE,
VALLENAR, VALPARAISO

### Tabla2 — PUERTOS DE EMBARQUE

- AEROPUERTO SANTIAGO
- PUERTO CALDERA
- PUERTO COQUIMBO
- PUERTO CORONEL
- PUERTO SAN ANTONIO
- PUERTO VALPARAISO

### Tabla3 — DEPOSITOS DE RETIRO

- AGUNSA SAN ANTONIO
- AGUNSA VALPARAISO
- CONTOPSA SAN ANTONIO
- D&C SAN ANTONIO
- D&C VALPARAISO
- MEDLOG SAN ANTONIO
- MEDLOG VALPARAISO
- SITRALS ALTO
- SITRANS CURAUMA

### Tabla14 — UNIDADES DE RUTAS

- BINS
- CONTENEDOR
- EXTRAS
- PALLETS
- THERMO
- PLATAFORMA (en la planilla aparece como "PLATADORMA", probable error de tipeo)
- UNDERSLUNG

### Tabla16 — UNIDAD DE MEDIDA ESPECIE

- BINS
- PALLETS

### Tabla19 — SITIOS DE ENTREGA

- CURICO
- SAN ANTONIO

### Tabla11 — TRAZABILIDADES

- DEPÓSITO-PLANTA-PUERTO
- PLANTA-PUERTO
- INTERPLANTA CONTENEDOR
- INTERPLANTA THERMO
- PUERTO-PLANTA
- INTERDEPÓSITO
- DEPÓSITO-PUERTO
- PUERTO-DEPÓSITO

### Tabla12 — TIPOS DE MOVILES

- CAMION
- CHASIS C/MOTOR
- CHASIS S/MOTOR
- PLATAFORMA
- THERMO
- TRACTOCAMION

### Tabla15 — CATEGORIAS DE EMPRESA

- SOCIO
- FLETERO
- EXTERNO

### Tabla17 — ESPECIES

- BINS
- CONTENEDOR
- MATERIALES
- THERMO

### Tabla18 — UNIDAD DE MEDIDA TARIFA

- BINS
- EXTRAS
- PALLETS
- UNDERSLUNG
- VIAJE

### Tabla20 — FORMAS PAGO

- CREDITO
- EFECTIVO
- TRANSFERENCIA

### Tabla21 — TIPOS DE DOCUMENTO

- BOLETA
- FACTURA
- GUIA
- OTRO
- VALE EMPRESA

### Tabla22 — ITEMS GASTO

- AMARRAS
- AVERIAS
- CARGA
- DESCARGA
- ESTACIONAMIENTO
- OTROS
- PASAJES
- TELEFONO

---

## 2. Empresas (Tabla4)

Empresas de transporte que realizan los fletes (socios, fleteros y externos).

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Empresa | Digitar | Razón social. |
| Rut | Digitar | |
| Activo | Casilla de Verificación | |
| Propietario | Digitar | |
| Fono | Digitar | Fono móvil. |
| Email | Digitar | |
| Categoria | BaseDatos | Elegir de un listado disponible (Tabla15 — CATEGORIAS DE EMPRESA). |

### Columnas de la tabla

RutEmpresa · Empresa · Activo · Propietario · Fono Móvil · Email · Categoria Empresa

### Datos de ejemplo

| RutEmpresa | Empresa | Propietario | Categoria |
|---|---|---|---|
| 77.862.070-7 | TRANSPORTES BRAVO SPA | EXEQUIEL BRAVO | SOCIO |
| 88.870.010-7 | TRANSPORTES B&B LIMITADA | EXEQUIEL BRAVO | SOCIO |
| 76.509.454-2 | TRANSPORTES LUIS ALBERTO UBILLA PRIDA EIRL | LUIS UBILLA | FLETERO |
| 76.249.598-8 | TRANSPORTES GASTON HERNANDEZ OLIVERA E.I.R.L | GASTÓN HERNÁNDEZ | FLETERO |
| 77.277.928-3 | TRANSPORTE Y COMERCIALIZADORA D Y G SPA | DAVID GUTIERREZ | FLETERO |
| 77.058.094-3 | TRANSPORTE RAMON EDUARDO ROJAS SANTOS E.I.R.L. | RAMON ROJAS | FLETERO |
| 77.207.514-6 | TRANSPORTES VERÓNICA TRINIDAD FEBRE OLIVA E.I.R.L | EDUARDO SALINAS | FLETERO |
| 14.498.703-9 | PATRICIA ALEJANDRA AVENDANO PEREDO | MARCELO CACERES | FLETERO |
| 77.386.144-7 | TRANSPORTES REY SPA | AXEL REY | FLETERO |
| 76.995.184-9 | TRANSPORTES PATRICIO GUILLERMO GONZALEZ FAUNDES E.I.R.L | PATRICIO GONZÁLEZ | FLETERO |

Las columnas Activo, Fono Móvil y Email están vacías en los datos de ejemplo.

### Nota funcional (de la planilla)

> Módulo que gestione el ingreso de empresas que hacen fletes, que permita
> ingresar y editar. Debe incorporar forma de ingresar, buscar, editar, y la
> posibilidad de visualizarlos todos.

---

## 3. Clientes (Tabla5)

Clientes que solicitan los fletes (exportadoras, plantas, etc.).

### Campos del formulario

| Campo | Tipo de entrada |
|---|---|
| Cliente | Digitar |
| Rut | Digitar |
| Activo | Casilla de Verificación |
| Giro | Digitar |
| Dirección | Digitar |
| Contacto Operaciones | Digitar |
| Contacto Administrativo | Digitar |
| Fono | Digitar |
| Email | Digitar |

### Columnas de la tabla

Cliente · Rut · Activo · Giro · Dirección · Contacto Operaciones · Contacto Administrativo · Fono · Email

### Datos de ejemplo

| Cliente | Rut | Dirección | Fono |
|---|---|---|---|
| COEXCA S.A. | 96.999.710-K | LONGITUDINAL SUR KM. 256, TALCA, REGION DEL MAULE | 71 263 1919 |
| EXPORTADORA PROPAL S.A. | 99.551.270-K | PANAMERICANA NORTE KM. 107, HIJUELAS, REGION DE VALPARAISO | 33 229 7400 |

Las columnas Activo, Giro, Contacto Operaciones, Contacto Administrativo y
Email están vacías en los datos de ejemplo.

### Nota funcional (de la planilla)

> Módulo que gestione el ingreso de clientes que piden fletes, que permita
> ingresar y editar. Debe incorporar forma de ingresar, buscar, editar, y la
> posibilidad de visualizarlos todos.

---

## 4. Packings (Tabla6)

Plantas de carga (packings) asociadas a un cliente.

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Código Planta | Digitar | En la tabla aparece como "Código Packing". |
| Cliente | BaseDatos | Elegir de un listado disponible (módulo Clientes). |
| Packing | Digitar | Nombre de la planta. |
| Ubicación | Digitar | Dirección. |

### Columnas de la tabla

Código Packing · Cliente · Packing · Ubicación

### Datos de ejemplo

| Código Packing | Cliente | Packing | Ubicación |
|---|---|---|---|
| (vacío) | PROPAL | HIJUELAS | PANAMERICANA NORTE KM. 107, HIJUELAS, REGION DE VALPARAISO |
| (vacío) | COEXCA | MAULE | LONGITUDINAL SUR KM. 256, TALCA, REGION DEL MAULE |

### Nota funcional (de la planilla)

> Módulo que gestione el ingreso de plantas de carga, que permita ingresar y
> editar. Debe incorporar forma de ingresar, buscar, editar, y la posibilidad
> de visualizarlos todos.

### Relaciones

- Cliente → módulo Clientes (Tabla5).

---

## 5. Móviles (Tabla7)

Parque de camiones y remolques. En "Tipo" se selecciona qué clase de móvil es.

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Patente | Digitar | |
| Marca | Digitar | |
| Modelo | Digitar | |
| Año | Digitar | |
| Tipo | BaseDatos | Elegir de un listado disponible (Tabla12 — TIPOS DE MOVILES). |
| Activo | Casilla de Verificación | |
| Empresa | BaseDatos | Elegir de un listado disponible (módulo Empresas). |
| Tipo Empresa | BaseDatos | Pregunta abierta en la planilla: ¿es posible que este dato aparezca automáticamente según la empresa seleccionada? Corresponde a la Categoria Empresa (SOCIO / FLETERO / EXTERNO). |
| Vencimiento Revisión Técnica | Digitar | Fecha. |
| Vencimiento Permiso Circulación | Digitar | Fecha. |
| Vencimiento Seguro | Digitar | Fecha. |

### Columnas de la tabla

Patente · Marca · Modelo · Año · Tipo · Activo · Empresa · Tipo Empresa · Vencimiento Revisión Técnica · Vencimiento Permiso Circulación · Vencimiento Seguro

### Datos de ejemplo

| Patente | Marca | Modelo | Año | Tipo | Empresa | Tipo Empresa |
|---|---|---|---|---|---|---|
| DRXR59 | FREIGHTLINER | ARGOZY | 2012 | CAMION | TRANSPORTES B&B LIMITADA | SOCIO |
| JH7077 | | | | CHASIS C/MOTOR | TRANSPORTES BRAVO SPA | SOCIO |
| JB8369 | GREAT DANE | | | THERMO | TRANSPORTES BRAVO SPA | SOCIO |
| RHGC58 | | | | TRACTOCAMION | TRANSPORTES BRAVO SPA | SOCIO |
| JK5362 | | | | CHASIS C/MOTOR | TRANSPORTES B&B LIMITADA | SOCIO |

Las columnas Activo y los tres vencimientos están vacías en los datos de ejemplo.

### Nota funcional (de la planilla)

> Aquí se ingresan los camiones y remolques. En Tipo se selecciona qué móvil es.
> Debe existir la capacidad de agregar, buscar y editar información, y de ver
> todo el parque, con capacidad de ordenar, filtrar, etc., similar a lo que
> puedas hacer en Excel.

### Relaciones

- Tipo → BaseDatos, Tabla12 (TIPOS DE MOVILES).
- Empresa → módulo Empresas (Tabla4).
- Tipo Empresa → derivado de la Categoria de la empresa seleccionada (a confirmar).

---

## 6. Conductores (Tabla8)

Conductores de los camiones, propios (trabajadores) o de empresas terceras.

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| RUT | Digitar | |
| Conductor | Digitar | Nombre completo. |
| Activo | Casilla de Verificación | |
| Tipo | Lista fija | Valores: TRABAJADOR / TERCERO. Pregunta abierta en la planilla: ¿es posible que este dato aparezca según el conductor seleccionado? (probablemente se refiere a la empresa seleccionada). |
| Empresa | BaseDatos | Elegir de un listado disponible (módulo Empresas). |
| % Comisión | Digitar | Porcentaje. En la planilla se guarda como fracción (0,08 = 8%). |
| N° Licencia | Digitar | |
| Vencimiento | Digitar | Fecha de vencimiento de la licencia. |
| Fecha Ingreso | Digitar | Fecha. |
| Término Contrato | Digitar | Fecha. |
| Dirección | Digitar | |
| Móvil | Digitar | Teléfono móvil. |
| N° Cuenta | Digitar | Cuenta bancaria. |
| Banco | Digitar | |

### Columnas de la tabla

RUT · Conductor · Activo · Tipo · Empresa · % Comisión · N° Licencia · Vencimiento · Fecha Ingreso · Término Contrato · Dirección · Móvil · N° Cuenta · Banco

### Datos de ejemplo

| RUT | Conductor | Tipo | Empresa | % Comisión |
|---|---|---|---|---|
| 9.809.727-9 | LUIS ENRIQUE GAETE PINO | TRABAJADOR | TRANSPORTES BRAVO SPA | 8% |
| 16.588.594-5 | FERNANDO ANTONIO CONTRERAS VALENZUELA | TRABAJADOR | TRANSPORTES B&B LIMITADA | 8% |
| 9.735.832-K | LUIS ALBERTO UBILLA PRIDA EIRL | TERCERO | TRANSPORTES LUIS ALBERTO UBILLA PRIDA EIRL | 92% |
| 17.527.134-1 | PATRICIO GUILLERMO GONZÁLEZ FAUNDES | TERCERO | TRANSPORTES PATRICIO GUILLERMO GONZALEZ FAUNDES E.I.R.L | 92% |

Las demás columnas están vacías en los datos de ejemplo. Se observa que los
conductores TRABAJADOR tienen 8% de comisión y los TERCERO 92%.

### Nota funcional (de la planilla)

> Aquí se ingresan los datos de los conductores. En Tipo se selecciona si
> pertenece a la empresa o a una empresa tercera. Debe existir la capacidad de
> ingresar, buscar y editar información, y visualizarlos a todos, como en
> planilla Excel, y filtrar, ordenar, etc.

### Relaciones

- Empresa → módulo Empresas (Tabla4).

---

## 7. Asignaciones (Tabla9)

Asigna a un camión un conductor y uno o más remolques (chasis, thermo o
plataforma). Es la configuración vigente que luego usan las órdenes de retiro
y de carga para autocompletar patentes.

### Nota funcional (de la planilla)

> Aquí se asignan a un camión un conductor y uno o más remolques.
> Por ejemplo, un camión, dependiendo del flete, podría tomar un chasis
> (portacontenedor) o un thermo, previamente asignado aquí.
> Esta parte es importante y debe existir la posibilidad de que se edite fácil
> y rápidamente, ya que debe estar actualizado al momento de generar las
> órdenes de carga.
> Por lo general, un camión siempre tiene el mismo conductor y chasis, lo que
> cambia de vez en cuando es que deja el chasis temporalmente para tomar un
> thermo.

La hoja incluye dos imágenes de referencia: un THERMO (semirremolque
refrigerado cerrado) y un CHASIS (portacontenedor).

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Empresa | BaseDatos | Elegir de un listado disponible (módulo Empresas). |
| Camión | BaseDatos | Elegir de un listado; en lo posible que aparezcan solo las patentes relacionadas con la Empresa seleccionada, con capacidad de editar. |
| Conductor | BaseDatos | Elegir de un listado; en lo posible que aparezcan solo los conductores relacionados con la Empresa seleccionada, con capacidad de editar. |
| Chasis | BaseDatos | Elegir de un listado de chasis, con capacidad de editar. |
| Thermo | BaseDatos | Elegir de un listado de thermos, con capacidad de editar. |
| Plataforma | BaseDatos | Elegir de un listado de plataformas, con capacidad de editar. |
| Fecha Asignación | Digitar | Fecha. |

### Columnas de la tabla

Empresa · Camión · Conductor · Chasis · Thermo · Plataforma · Fecha Asignación

### Datos de ejemplo

| Empresa | Camión | Conductor | Chasis | Thermo | Plataforma | Fecha Asignación |
|---|---|---|---|---|---|---|
| TRANSPORTES BRAVO SPA | RHGC58 | DAVID ALEJANDRO CONTRERAS VALENZUELA | JK5362 | | | 20/10/2026 |

### Relaciones

- Empresa → módulo Empresas.
- Camión → módulo Móviles, Tipo CAMION o TRACTOCAMION, filtrado por Empresa.
- Conductor → módulo Conductores, filtrado por Empresa.
- Chasis → módulo Móviles, Tipo CHASIS C/MOTOR o CHASIS S/MOTOR.
- Thermo → módulo Móviles, Tipo THERMO.
- Plataforma → módulo Móviles, Tipo PLATAFORMA.

---

## 8. Rutas Tarifas (Tabla10)

Tarifas por tramo y unidad, por cliente. Se incorporan en las órdenes de carga.

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Código Ruta | Digitar | |
| Cliente | BaseDatos | Elegir de un listado disponible (módulo Clientes). |
| Origen | BaseDatos | Elegir de un listado disponible (Tabla13 CIUDADES). |
| Destino | BaseDatos | Elegir de un listado disponible (Tabla13 CIUDADES). |
| Unidad | BaseDatos | Elegir de un listado disponible (Tabla14 UNIDADES DE RUTAS). |
| Tramo | Cálculo | Que se genere solo, de acuerdo a lo ingresado antes. Formato observado: "ORIGEN - DESTINO - UNIDAD". |
| Distancia | Digitar | Kilómetros, almacenado como número (374 se muestra "374,0 Kms"). |
| Valor | Digitar | Monto en pesos, almacenado como número. |
| Vigencia | Digitar | Fecha hasta la cual rige la tarifa. |

### Columnas de la tabla

Código · Cliente · Origen · Destino · Unidad · Tramo · Distancia Ruta · Valor · Vigencia

### Datos de ejemplo

| Código | Cliente | Origen | Destino | Unidad | Tramo | Distancia Ruta | Valor | Vigencia |
|---|---|---|---|---|---|---|---|---|
| (vacío) | COEXCA | TALCA | VALPARAISO | CONTENEDOR | TALCA - VALPARAISO - CONTENEDOR | 374,0 Kms | $ 565.000 | 31/12/2022 |
| (vacío) | COEXCA | BUIN | SAN ANTONIO | CONTENEDOR | BUIN - SAN ANTONIO - CONTENEDOR | 111,0 Kms | $ 315.000 | 31/12/2022 |
| (vacío) | PROPAL | TUNICHE | HIJUELAS | THERMO | TUNICHE - HIJUELAS - THERMO | | $ 400.000 | 31/12/2022 |
| (vacío) | COEXCA | TALCA | VALPARAISO | UNDERSLUNG | TALCA - VALPARAISO - UNDERSLUNG | 374,0 Kms | $ 80.000 | 31/12/2022 |

### Nota funcional (de la planilla)

> Aquí se ingresan las tarifas y tramos a incorporar en las órdenes de carga.

### Relaciones

- Cliente → módulo Clientes.
- Origen y Destino → BaseDatos, Tabla13 CIUDADES.
- Unidad → BaseDatos, Tabla14 UNIDADES DE RUTAS.

---

## 9. Orden de Retiro

Primer documento del flujo operativo. Registra el retiro de una unidad y todos
los datos del flete. De ella cuelgan el Vale de Dinero, la Orden de Carga y la
Orden de Entrega de Combustible.

### Campos del formulario

| Campo | Tipo de entrada | Observación |
|---|---|---|
| N° Orden de Retiro | Correlativo Automático | |
| Fecha de Orden de Retiro | Digitar | |
| Trazabilidad | BaseDatos | Elegir de un listado disponible (Tabla11 TRAZABILIDADES). |
| Conductor | BaseDatos | Elegir de un listado disponible (módulo Conductores). |
| Patente Camión | BaseDatos | ¿Es posible que este dato aparezca según el conductor seleccionado? Que exista igual capacidad de modificar. |
| Patente Remolque | BaseDatos | ¿Es posible que este dato aparezca según la patente de camión seleccionada? Que exista igual capacidad de modificar. |
| Tipo Remolque | BaseDatos | ¿Es posible que este dato aparezca según la patente del remolque seleccionada? |
| Empresa | BaseDatos | ¿Es posible que este dato aparezca según el conductor seleccionado? Que exista igual capacidad de modificar. |
| Cliente | BaseDatos | Elegir de un listado disponible (módulo Clientes). |
| Origen | BaseDatos | Elegir de un listado disponible (Tabla13 CIUDADES). |
| Destino | BaseDatos | Elegir de un listado disponible (Tabla13 CIUDADES). |
| Depósito de Retiro | BaseDatos | Elegir de un listado disponible (Tabla3 DEPOSITOS DE RETIRO). |
| Packing de Carga | BaseDatos | Elegir de un listado disponible (módulo Packings). |
| Fecha de Carga | Digitar | |
| Hora de Carga | Digitar | |
| Depósito de Entrega | BaseDatos | Elegir de un listado disponible (Tabla3 DEPOSITOS DE RETIRO). |
| Packing de Entrega | BaseDatos | Elegir de un listado disponible (módulo Packings). |
| Destino (texto) | Digitar | Segundo campo "Destino" de la planilla, de texto libre. Distinto del Destino de listado. |
| Nave | Digitar | |
| MTB | Digitar | |
| Booking | Digitar | |
| Puerto de Embarque | BaseDatos | Elegir de un listado disponible (Tabla2 PUERTOS DE EMBARQUE). |
| Fecha de Embarque | Digitar | |
| Hora Embarque | Digitar | |
| OP N° | Digitar | |
| O/C | Digitar | Orden de compra. |
| Observaciones | Digitar | |

### Observaciones (de la planilla)

> Generar un PDF y EXCEL con los datos de la Orden de Retiro.
> Generar en el software una pantalla que muestre todas las Órdenes de Retiro
> filtradas por día, entre días y por mes, exportable a PDF y EXCEL.

### Relaciones

- Conductor → Conductores. A partir de él se sugieren Empresa y Patente Camión (vía Asignaciones), siempre editables.
- Patente Camión → Móviles. A partir de ella se sugiere Patente Remolque (vía Asignaciones), editable.
- Tipo Remolque → se deriva del Tipo del remolque en Móviles.
- Trazabilidad → Tabla11. Depósitos → Tabla3. Puerto de Embarque → Tabla2. Origen y Destino → Tabla13.
- Cliente → Clientes. Packing de Carga y Packing de Entrega → Packings.

---

## 10. Vale Dinero (Anticipo de Viajes)

Anticipo de dinero entregado al conductor para un viaje, asociado a una Orden
de Retiro.

### Descripción (de la planilla)

> Una vez ingresada la Orden de Retiro, es posible ingresar un Vale de Dinero
> para el viaje. Para hacerla, el usuario debiera tener en vista las órdenes de
> retiro activas. El propósito es que el usuario seleccione la Orden de Retiro
> a la cual le asignará el vale de dinero.
> Una vez seleccionada la Orden de Retiro, que se genere una ventana con un N°
> de Orden de Vale y con los siguientes registros provenientes de la Orden de
> Retiro y con los campos a completar.

### Encabezado

| Campo | Tipo de entrada |
|---|---|
| N° Orden de Retiro | Heredado |
| Fecha de Orden de Retiro | Heredado |
| N° Vale | Correlativo Automático |

### Campos a completar

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Fecha de Entrega | Digitar | |
| Concepto | Digitar | Por defecto que aparezca FLETE. |
| Glosa | Digitar | |
| Sitio de Entrega | BaseDatos | Elegir de un listado disponible (Tabla19 SITIOS DE ENTREGA). |
| Monto Entregado | Digitar | En formato moneda y con separador de miles. |
| Forma de Pago | BaseDatos | Elegir de un listado disponible (Tabla20 FORMAS PAGO). |

### Datos heredados de la Orden de Retiro

Cliente · Origen · Destino · Trazabilidad · Conductor · Rut · Empresa · Patente Camión · Patente Remolque

Ejemplo de la planilla: COEXCA · TALCA · VALPARAISO · DEPOSITO - PLANTA - PUERTO ·
RICARDO PÉREZ · XXXXX · TRANSPORTES B&B LIMITADA · DRXX82 · JH7163 (datos
ilustrativos, no coinciden con los mantenedores).

### Observaciones (de la planilla)

> Generar un PDF y EXCEL con los datos del Anticipo.
> Generar en el software una pantalla que muestre todos los Anticipos filtrados
> por día, entre días y por mes, exportable a PDF y EXCEL.

---

## 11. Orden de Carga

Documento que sigue a la Orden de Retiro. Registra las guías del flete y
valoriza el viaje según las tarifas del cliente.

### Descripción (de la planilla)

> Es lo que prosigue a la elaboración de la Orden de Retiro. Para hacerla, el
> usuario debiera tener en vista las órdenes de retiro activas y sin una orden
> de carga asignada. El propósito es que el usuario seleccione la Orden de
> Retiro a la cual le asignará el número de orden de carga y así seguir con el
> proceso.
> Una vez seleccionada la Orden de Retiro, que se genere una ventana con un N°
> de Orden de Carga y con los siguientes registros provenientes de la Orden de
> Retiro.

### Encabezado

| Campo | Tipo de entrada |
|---|---|
| N° Orden de Retiro | Heredado |
| Fecha de Orden de Retiro | Heredado |
| N° Orden Carga | Correlativo Automático |

### Datos heredados de la Orden de Retiro

- Trazabilidad · Conductor · Patente Camión · Patente Remolque · Cliente
- Origen · Destino · Puerto de Embarque · Fecha de Embarque · Hora Embarque
- Depósito de Retiro · Depósito de Entrega · Packing de Entrega
- Fecha de Carga · Hora de Carga · Packing de Carga

### Campos a completar

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Tramo | BaseDatos | Elegir de un listado disponible, pero que aparezcan solo los tramos que tienen que ver con el Cliente (Rutas Tarifas filtrado por Cliente). |

### Ingreso de Guías del Flete

Tabla de detalle, una fila por guía y tramo.

| Columna | Tipo de entrada | Observación |
|---|---|---|
| N° Guía | Digitar | |
| Fecha de Guía | Digitar | |
| Especie | BaseDatos | Tabla17 ESPECIES. |
| Unidad de Medida Especie | BaseDatos | Tabla16 UNIDAD DE MEDIDA ESPECIE. |
| Cantidad | Digitar | Cantidad de la especie. |
| N° Contenedor | Digitar | |
| Tramo/Tarifa | BaseDatos | Rutas Tarifas, tramos del cliente. |
| Unidad de Medida Tarifa | BaseDatos | Tabla18 UNIDAD DE MEDIDA TARIFA. |
| Cantidad | Digitar | Cantidad a tarifar. |
| Valor Unitario $ | Cálculo | Aparece al seleccionar el Tramo (Valor de Rutas Tarifas). |
| Total $ | Cálculo | Cantidad × Valor Unitario. |

**Totales Neto Guías**: suma de la columna Total $.

Ejemplo de la planilla:

| N° Guía | Fecha de Guía | Especie | U.M. Especie | Cantidad | N° Contenedor | Tramo/Tarifa | U.M. Tarifa | Cantidad | Valor Unitario $ | Total $ |
|---|---|---|---|---|---|---|---|---|---|---|
| 7349 | 15/10/2026 | CONTENEDOR | PALLETS | 20 | BUN38483483 | TALCA - VALPARAISO - CONTENEDOR | VIAJE | 1 | $565.000 | $565.000 |
| 7349 | 15/10/2026 | CONTENEDOR | PALLETS | 20 | BUN38483483 | TALCA - VALPARAISO - UNDERSLUNG | UNDERSLUNG | 1 | $80.000 | $80.000 |

Totales Neto Guías: $645.000

### Hoja de Ruta (de la planilla)

> Creadas las guías, se genera otro número, N° Hoja de Ruta, y el sistema lo
> debe generar en el orden en que las unidades van cargando, por lo que la
> fecha que rige para hacerlo correlativo es la Fecha de Carga.

### Observaciones (de la planilla)

> Generar un PDF y EXCEL con los datos de la Orden de Carga.
> Generar en el software una pantalla que muestre todas las Órdenes de Carga
> filtradas por día, entre días y por mes, exportable a PDF y EXCEL.

---

## 12. Vale Combustible (Orden de Entrega de Combustible)

Registro de la carga de combustible al terminar un flete, asociado a una Orden
de Retiro.

### Descripción (de la planilla)

> La Orden de Entrega de Combustible se genera cada vez que un flete es
> terminado. Para hacerla, el usuario debiera tener en vista las órdenes de
> retiro activas. El propósito es que el usuario seleccione la Orden de Retiro
> a la cual le asignará la Orden de Entrega de Combustible.
> Una vez seleccionada la Orden de Retiro, que se genere una ventana con un N°
> de Orden de Entrega y con los siguientes registros provenientes de la Orden
> de Retiro.

### Encabezado

| Campo | Tipo de entrada |
|---|---|
| N° Orden de Retiro | Heredado |
| Fecha de Orden de Retiro | Heredado |
| N° Orden Entrega | Correlativo Automático |

### Campos a completar

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Fecha de Entrega | Digitar | |
| Hora de Entrega | Digitar | |
| Sitio de Entrega | BaseDatos | Elegir de un listado disponible (Tabla19 SITIOS DE ENTREGA). |
| Forma de Pago | BaseDatos | Tabla20 FORMAS PAGO. |
| Tipo Documento | BaseDatos | Tabla21 TIPOS DE DOCUMENTO. |

### Carga por unidad

| Campo | Camión | Remolque |
|---|---|---|
| Patente | BaseDatos | BaseDatos |
| Numeral Inicial Bomba | Digitar | Digitar |
| Numeral Final Bomba | Digitar | Digitar |

### Resumen y cálculo

| Columna | Origen |
|---|---|
| Cliente · Trazabilidad · Origen · Destino · Conductor · Rut · Empresa | Heredado de la Orden de Retiro. |
| Litros Camión | Cálculo: diferencia de numerales del camión (final − inicial). |
| Litros Remolque | Cálculo: diferencia de numerales del remolque. |
| Total Litros | Cálculo: suma de litros. |
| Valor Litro | Valor por defecto y editable. |
| Total | Cálculo: Litros × Valor. |

### Observaciones (de la planilla)

> Generar un PDF y EXCEL con los datos de la Entrega.
> Generar en el software una pantalla que muestre todas las Entregas filtradas
> por día, entre días y por mes, exportable a PDF y EXCEL.

---

## 13. Rendiciones

Rendición de gastos del flete, asociada a una Orden de Carga.

### Descripción (de la planilla)

> Es lo que prosigue a la elaboración de la Orden de Retiro y Orden de Carga.
> Para hacerla, el usuario debiera tener en vista las Órdenes de Carga activas.
> El propósito es que el usuario seleccione la Orden de Carga a la cual le
> asignará el número de Rendición, el cual debe ser correlativo.
> Una vez seleccionada la Orden de Carga, que se genere una ventana con un N°
> de Rendición y con los siguientes registros provenientes de la Orden de Carga
> y Retiro.

### Encabezado

| Campo | Tipo de entrada |
|---|---|
| N° de Rendición de Fletes | Correlativo Automático |
| Fecha Rendición | Digitar |

### Datos heredados de la Orden de Carga y de Retiro

- N° Orden de Retiro · Fecha de Orden de Retiro · N° Orden Carga
- Trazabilidad · Conductor · Patente Camión · Patente Remolque
- Cliente · Origen · Destino
- Tramo
- Fecha de Carga · Hora de Carga · Packing de Carga

### Datos del viaje

| Campo | Tipo de entrada | Observación |
|---|---|---|
| Fecha Salida | Digitar | |
| Hora Salida | Digitar | |
| Fecha Llegada | Digitar | |
| Hora Llegada | Digitar | |
| Odómetro Inicial | Digitar | |
| Odómetro Final | Digitar | |
| Kilómetros Recorridos | Cálculo | Odómetro Final − Odómetro Inicial. |
| Observaciones | Digitar | |
| Fecha Entrega | Digitar | |
| Sitio de Entrega | BaseDatos | Elegir de un listado disponible (Tabla19 SITIOS DE ENTREGA). |

### Detalle de Gastos

| Campo | Tipo de entrada |
|---|---|
| Peajes | Digitar |
| Carga | Digitar |
| Descarga | Digitar |

### Viáticos (tabla de varias filas)

| Fecha | Desayuno | Almuerzo | Comida | Total |
|---|---|---|---|---|
| Digitar | Digitar | Digitar | Digitar | Cálculo |

**Total Viáticos**: suma de la columna Total.

### Otros Gastos (tabla de varias filas)

| Tipo Documento | N° Documento | Rut Proveedor | Fecha | Monto | Ítem Gasto | Observaciones |
|---|---|---|---|---|---|---|
| BaseDatos (Tabla21) | Digitar | Digitar | Digitar | Digitar | BaseDatos (Tabla22) | Digitar |

**Total Otros Gastos**: suma de la columna Monto.

La hoja termina en "Total Otros Gastos". A diferencia de los demás documentos
operativos, no indica total general de la rendición, exportación a PDF y Excel
ni pantalla de listado.

---

## Flujo operativo

```
Orden de Retiro (N° correlativo)
 ├── Vale de Dinero / Anticipo (N° correlativo)        <- se elige entre las órdenes de retiro activas
 ├── Orden de Carga (N° correlativo)                   <- órdenes de retiro activas sin orden de carga
 │    ├── Guías del flete (detalle valorizado por tramo)
 │    ├── N° Hoja de Ruta (correlativo según Fecha de Carga)
 │    └── Rendición de Fletes (N° correlativo)         <- se elige entre las órdenes de carga activas
 └── Orden de Entrega de Combustible (N° correlativo)  <- órdenes de retiro activas, al terminar el flete
```

## Resumen de relaciones entre módulos

| Módulo | Campo | Se alimenta de |
|---|---|---|
| Empresas | Categoria | BaseDatos · Tabla15 CATEGORIAS DE EMPRESA |
| Packings | Cliente | Clientes |
| Móviles | Tipo | BaseDatos · Tabla12 TIPOS DE MOVILES |
| Móviles | Empresa | Empresas |
| Móviles | Tipo Empresa | Empresas (Categoria), posiblemente automático |
| Conductores | Empresa | Empresas |
| Asignaciones | Empresa | Empresas |
| Asignaciones | Camión, Chasis, Thermo, Plataforma | Móviles, filtrado por Tipo y Empresa |
| Asignaciones | Conductor | Conductores, filtrado por Empresa |
| Rutas Tarifas | Cliente | Clientes |
| Rutas Tarifas | Origen, Destino | BaseDatos · Tabla13 CIUDADES |
| Rutas Tarifas | Unidad | BaseDatos · Tabla14 UNIDADES DE RUTAS |
| Orden de Retiro | Trazabilidad | BaseDatos · Tabla11 TRAZABILIDADES |
| Orden de Retiro | Conductor | Conductores |
| Orden de Retiro | Patente Camión, Patente Remolque | Móviles, sugeridos desde Asignaciones |
| Orden de Retiro | Tipo Remolque | Móviles (Tipo del remolque) |
| Orden de Retiro | Empresa | Empresas, sugerida desde el conductor |
| Orden de Retiro | Cliente | Clientes |
| Orden de Retiro | Origen, Destino | BaseDatos · Tabla13 CIUDADES |
| Orden de Retiro | Depósito de Retiro, Depósito de Entrega | BaseDatos · Tabla3 DEPOSITOS DE RETIRO |
| Orden de Retiro | Packing de Carga, Packing de Entrega | Packings |
| Orden de Retiro | Puerto de Embarque | BaseDatos · Tabla2 PUERTOS DE EMBARQUE |
| Vale Dinero | Orden de Retiro | Orden de Retiro (activas) |
| Vale Dinero | Sitio de Entrega | BaseDatos · Tabla19 SITIOS DE ENTREGA |
| Vale Dinero | Forma de Pago | BaseDatos · Tabla20 FORMAS PAGO |
| Orden de Carga | Orden de Retiro | Orden de Retiro (activas sin orden de carga) |
| Orden de Carga | Tramo, Tramo/Tarifa | Rutas Tarifas, filtrado por Cliente |
| Orden de Carga | Especie | BaseDatos · Tabla17 ESPECIES |
| Orden de Carga | Unidad de Medida Especie | BaseDatos · Tabla16 UNIDAD DE MEDIDA ESPECIE |
| Orden de Carga | Unidad de Medida Tarifa | BaseDatos · Tabla18 UNIDAD DE MEDIDA TARIFA |
| Vale Combustible | Orden de Retiro | Orden de Retiro (activas) |
| Vale Combustible | Sitio de Entrega | BaseDatos · Tabla19 SITIOS DE ENTREGA |
| Vale Combustible | Forma de Pago | BaseDatos · Tabla20 FORMAS PAGO |
| Vale Combustible | Tipo Documento | BaseDatos · Tabla21 TIPOS DE DOCUMENTO |
| Vale Combustible | Patente Camión, Patente Remolque | Móviles |
| Rendiciones | Orden de Carga | Orden de Carga (activas) |
| Rendiciones | Sitio de Entrega | BaseDatos · Tabla19 SITIOS DE ENTREGA |
| Rendiciones | Tipo Documento (Otros Gastos) | BaseDatos · Tabla21 TIPOS DE DOCUMENTO |
| Rendiciones | Ítem Gasto (Otros Gastos) | BaseDatos · Tabla22 ITEMS GASTO |

## Requisitos transversales

### Mantenedores

Empresas, Clientes, Packings, Móviles, Conductores, Asignaciones y Rutas
Tarifas comparten las mismas operaciones:

1. Ingresar un registro nuevo.
2. Buscar registros.
3. Editar un registro existente.
4. Visualizar el listado completo.

En Móviles y Conductores se pide además ordenar y filtrar el listado completo,
con una experiencia similar a la de Excel. En Asignaciones se pide edición
rápida y fácil porque debe estar al día al generar órdenes de carga.

### Documentos operativos

Orden de Retiro, Vale Dinero, Orden de Carga, Vale Combustible y Rendiciones
comparten estas reglas:

1. Número correlativo automático.
2. Se crean seleccionando el documento padre desde un listado de documentos
   activos (Orden de Retiro o, en Rendiciones, Orden de Carga).
3. Heredan los datos del padre sin volver a digitarlos.
4. Exportación del documento a PDF y Excel.
5. Pantalla de listado de todos los documentos del tipo, filtrable por día,
   entre días y por mes, exportable a PDF y Excel.

### Autocompletado editable

Varios campos se sugieren a partir de otra selección (patente desde conductor,
remolque desde camión, empresa desde conductor, valor unitario desde tramo),
pero siempre deben poder modificarse manualmente.

## Resolución en la plataforma (27-10-2026)

La plataforma se construyó con supuestos por defecto para cada duda (detalle en
`plan.md`, sección 2, y `decisiones.md`). Resumen:

| Duda | Cómo quedó |
|---|---|
| Tipo Empresa en Móviles | Se muestra automáticamente desde la categoría de la empresa. |
| PLATADORMA | Corregido a PLATAFORMA al importar. |
| Código Packing y Código Ruta | Se generan PK-001 y RT-001 si se dejan vacíos; son editables. |
| Tipo en Conductores | Se sugiere según la categoría de la empresa; editable. |
| Doble campo Destino | Destino (ciudad de la lista) y Destino final (texto libre). |
| MTB | Campo de texto libre. |
| Orden activa | Abierta o Con carga; deja de estar activa al cerrarse (rendición) o anularse. |
| Hoja de ruta | Un número por orden de carga, asignado al guardar sus primeras guías. |
| Rendiciones | Incluyen total general, PDF, Excel y listado como los demás documentos. |
| Espacios finales en catálogos | Se limpian al importar. |

Problemas de datos detectados al importar la planilla:

- El RUT de TRANSPORTES B&B LIMITADA (88.870.010-7) tiene el dígito verificador erróneo: para
  ese número corresponde 2. Se importó tal cual y se puede corregir al editar la empresa.
- La asignación de ejemplo nombra al conductor DAVID ALEJANDRO CONTRERAS VALENZUELA, que no
  existe en la hoja Conductores. Se importó la asignación sin conductor.
- Las cuatro tarifas vencieron el 31-12-2022. Hay que actualizar su vigencia o cargar las
  tarifas actuales.

## Pendientes y dudas abiertas (al momento del levantamiento)

- Confirmar si "Tipo Empresa" en Móviles se completa solo a partir de la empresa.
- Corregir "PLATADORMA" → "PLATAFORMA" en Tabla14 (UNIDADES DE RUTAS).
- Definir el formato del Código Packing y del Código Ruta (vacíos en los ejemplos).
- Conductores: la nota sobre "Tipo" habla del conductor seleccionado; aclarar si
  TRABAJADOR / TERCERO debe deducirse de la empresa (SOCIO vs FLETERO).
- Orden de Retiro: hay dos campos "Destino" (uno de listado y uno de texto).
  Confirmar el significado del segundo.
- Orden de Retiro: aclarar el significado de "MTB".
- Definir qué significa que una Orden de Retiro u Orden de Carga esté "activa"
  (estados del documento, cuándo deja de estar activa).
- Orden de Carga: definir si el N° Hoja de Ruta se genera por orden de carga o
  por guía.
- Rendiciones: confirmar si requiere total general (peajes, carga, descarga,
  viáticos y otros gastos), exportación a PDF y Excel y pantalla de listado
  como los demás documentos; la hoja no lo indica.
- BaseDatos: limpiar espacios finales en "LOS NICHES ", "RAPEL " y en el
  título "FORMAS PAGO ".
- Vale Combustible: confirmar que Patente Camión y Patente Remolque se heredan
  de la Orden de Retiro aunque la planilla las marque como BaseDatos.
