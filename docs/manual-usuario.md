# Manual de usuario de NexusTrack

Guía breve para el equipo de operaciones y finanzas.

## Ingresar

1. Abra la dirección de NexusTrack en el navegador e ingrese su correo y contraseña.
2. La sesión se mantiene al recargar la página. Para salir, use el menú con su nombre, arriba a la derecha, y elija **Cerrar sesión**.
3. Para cambiar su contraseña, use **Cambiar contraseña** en ese mismo menú. Debe tener al menos 8 caracteres, con letras y números. Al cambiarla se cierran sus sesiones abiertas en otros equipos.

El ícono de luna o sol, junto a su nombre, cambia entre tema claro y oscuro.

## Trabajar con las grillas

Todos los listados funcionan como una planilla:

- **Buscar** en todas las columnas con el cuadro de búsqueda.
- **Filtrar** una columna con el ícono de embudo de su encabezado. Las columnas con pocos valores, como Cliente o Estado, ofrecen una lista para marcar, igual que el autofiltro de Excel.
- **Ordenar** haciendo clic en el encabezado. Mantenga Ctrl o Cmd para ordenar por varias columnas.
- **Elegir columnas** visibles con el selector "Columnas". La elección queda guardada en su navegador.
- **Exportar** a Excel o PDF exactamente lo que está viendo: con los filtros, el orden y las columnas elegidas.
- **Limpiar** búsqueda y filtros con el ícono de embudo tachado.

Haga clic en una fila para abrir el registro.

## Fechas, horas y RUT

- **Fechas**: escriba solo los números (31122027) y las barras se agregan solas, o elija el día en el calendario. Con el campo vacío aparece el botón **Hoy**.
- **Horas**: formato de 24 horas. Escriba los números (1430 queda 14:30; 930 queda 09:30) o haga clic en el campo o en el reloj y elija la hora (00 a 23) y los minutos (00 a 59). **Ahora** pone la hora actual.
- **RUT**: escriba los números y el dígito verificador; los puntos y el guion se agregan solos.

## Menú

Los grupos del menú (Operación, Informes, Mantenedores, Administración) se abren y cierran con un clic en su título; cada navegador recuerda cómo los dejó. Mantenedores y Administración parten cerrados, y el grupo de la pantalla en que está se muestra siempre. **Abrir todo** / **Cerrar todo**, sobre los grupos, los despliega o pliega de una vez. Con el menú contraído (solo íconos) se ven todos.

## Trazabilidad

**Trazabilidad** (bajo Inicio) muestra el historial GPS de cualquier unidad del grupo de camiones: elija la unidad y el período (**Hoy**, **Ayer**, **24 h**, **48 h**, **7 días**, **30 días** o **Entre fechas**, hasta 31 días por vez). Se ven la ruta en el mapa, la distancia, el tiempo en movimiento y detenido, la velocidad y la lista de viajes y paradas; haga clic en una para verla en el mapa. El botón de actualizar trae lo último. La aplicación guarda las posiciones cada minuto y conserva al menos 40 días.

## Mantenedores

Empresas, clientes, packings, móviles, conductores y rutas y tarifas se manejan igual: botón **Nuevo** arriba a la derecha y clic en una fila para editar. Los registros no se borran: se desactivan con el interruptor **Activo**.

- **RUT**: se escribe con o sin puntos; el sistema lo formatea y valida el dígito verificador.
- **Móviles**: las fechas de vencimiento en rojo están vencidas y en ámbar vencen en 30 días o menos. El tipo de empresa se toma de la empresa elegida.
- **Conductores**: al elegir la empresa se sugiere el tipo (trabajador si la empresa es socia, tercero en otro caso). El % de comisión se escribe como porcentaje, por ejemplo 8.
- **Packings**: el código lo asigna el sistema, en orden (PK-001, PK-002…); no se pide al crear ni se puede cambiar. **Rutas**: si deja el código vacío, se asigna RT-001; si lo escribe, el guion se agrega solo (COX005 queda COX-005).
- **Rutas y tarifas**: el tramo se arma solo con origen, destino y unidad. La vigencia define en qué fechas se ofrece la tarifa.

### Asignaciones

Muestra cada camión con su conductor y remolques vigentes. Es lo que permite completar automáticamente las órdenes de retiro, por eso conviene mantenerla al día.

- Clic en la fila o en el lápiz para cambiar la asignación. La anterior se cierra con la fecha indicada y queda en el **historial**.
- Los remolques o conductores que ya están en otro camión aparecen marcados ("en RHGC58"). Libere primero ese camión con la **X**.

## Flujo de un flete

### 1. Orden de retiro

**Operación → Órdenes de retiro → Nueva orden de retiro.**

Al elegir el **conductor**, el sistema completa empresa, camión y remolque según su asignación vigente. Puede cambiarlos. Al elegir otro camión, se propone su remolque. El remolque depende de la **trazabilidad**: **PLANTA-PUERTO** (y las que dicen THERMO) llevan el **thermo** asignado al camión; las demás mueven contenedores y llevan el **chasis**. Si el camión no tiene asignado el tipo que corresponde, el remolque queda vacío y un aviso pide elegirlo. Al presionar **Emitir** se asigna el número correlativo.

Desde la orden de retiro se crean los demás documentos, en la sección **Documentos del flete**.

### 2. Orden de carga

Botón **Crear orden de carga** en la orden de retiro, o **Órdenes de carga → Nueva** y elegir la orden de retiro en la lista.

- El **tramo** lista las tarifas del cliente: primero las de la ruta de la orden. Las que no rigen a la fecha de carga aparecen con su fecha de vencimiento y un aviso; se actualizan en **Mantenedores → Rutas y tarifas**.
- En **Guías del flete**, cada fila es una guía y un tramo. Al elegir el tramo se propone su valor unitario, que puede modificar. **Agregar guía** copia los datos de la fila anterior.
- Si deja vacío el tramo de la cabecera, la orden toma el de la primera guía.
- Al guardar con al menos una guía se asigna el **N° de hoja de ruta** (ver Hojas de ruta).

### 3. Vale de dinero

Anticipo para el viaje. Se crea desde la orden de retiro o desde **Vales de dinero → Nuevo**. El concepto por defecto es FLETE. Para el anticipo de una **estadía**, en **Nuevo** elija **Estadía** y luego la estadía, o use **Entregar anticipo** en la misma estadía.

Debajo aparece la **cuenta del conductor**: su saldo según los fletes ya rendidos, los anticipos ya entregados para esta orden y los de otros fletes que aún no rinde. Sirve para decidir cuánto entregarle.

### 4. Vale de combustible

Se emite al terminar el flete. Las patentes vienen de la orden de retiro. Ingrese los numerales inicial y final de la bomba; los litros y el total se calculan solos. El valor del litro viene de Parámetros y se puede cambiar en cada vale.

### 5. Rendición

Desde la orden de carga, botón **Crear rendición**, o **Rendiciones → Nueva**. Solo aparecen órdenes de carga con guías registradas.

Complete salida, llegada y odómetros (los kilómetros se calculan solos), peajes, carga, descarga y **petróleo** pagado en ruta, los **viáticos** por día y los **otros gastos** con su documento.

- **Motor del remolque**: junto a la patente y el tipo de remolque, marque **Con motor** o **Sin motor** según lo que indica el conductor; el uso del motor se cobra aparte. Para dejarlo sin indicar, vuelva a hacer clic en la opción marcada.
- **Horómetros**: a la derecha de los odómetros, el horómetro inicial y final del motor del remolque; el **total de horas** se calcula solo y sirve para el rendimiento del motor. Al emitir la rendición, la orden de carga queda **Rendida** y la orden de retiro **Cerrada**.

Al final está la **cuenta del conductor**, que se recalcula mientras escribe: saldo anterior + anticipos de este flete − gastos de esta rendición = saldo de la cuenta.

**Trazabilidad**: el botón **Trazabilidad**, arriba junto a PDF y Excel, abre sin salir de la rendición el mapa con la ruta del camión entre la salida y la llegada anotadas (aunque todavía no se haya guardado). A la derecha se ven la distancia según el GPS junto a los kilómetros rendidos, el tiempo en movimiento y detenido, y la lista de viajes y paradas: haga clic en una para verla en el mapa. Con **± 1 h** o **± 3 h** se amplía el período, para revisar si las horas anotadas calzan con el GPS. Las paradas naranjas son con motor encendido y las grises con motor apagado. Si no hay llegada anotada, se muestran 2 días desde la salida.

## Estadías

**Operación → Estadías** registra los gastos del conductor mientras espera en un lugar, sin orden de carga ni de retiro. Una estadía es una rendición más: usa el mismo correlativo que las rendiciones de fletes y aparece también en **Rendiciones** (columna Tipo).

- **Nueva estadía**: elija el **conductor** (el camión y el remolque se completan desde su asignación vigente y se pueden cambiar) y el **lugar de la estadía**, que es su destino; el origen es siempre **ESTADÍA**.
- En **Período de la estadía** anote el **inicio** (obligatorio) y el término; los odómetros y horómetros son opcionales. Luego los gastos, viáticos y otros gastos, igual que en una rendición.
- El anticipo se entrega con un **vale de dinero** de la estadía (botón **Entregar anticipo**). Anticipos y gastos entran a la cuenta del conductor como un flete más.
- Recibe su **N° de hoja de ruta** según la fecha de inicio.
- Para anular o eliminar una estadía, primero se anulan o eliminan sus vales.

## Hojas de ruta

**Operación → Hojas de ruta** lista una hoja por cada flete con guías y una por cada estadía, con las columnas de la planilla: N° hoja, fecha, origen, destino, chofer, patente y los gastos rendidos (total, peajes, carga y descarga, viáticos, varios y petróleo).

- El **N° de hoja de ruta** es correlativo por **fecha de carga** (en una estadía, su fecha de inicio); en un mismo día, por hora y luego por orden de ingreso. Si se ingresa un flete o una estadía con fecha anterior, las hojas siguientes se corren en uno. Las anuladas salen de la numeración.
- La numeración parte del valor de **Parámetros → HOJA_RUTA_INICIAL**, para continuar la de la planilla.
- Haga clic en una hoja para ver su detalle: datos del viaje, enlaces a sus documentos, guías, orden de retiro, viaje y gastos rendidos, con **Trazabilidad**, **PDF** y **Excel**. Si el flete aún no se rinde, ofrece **Crear rendición**.

## Cuentas de conductores

**Operación → Cuentas de conductores** muestra el saldo de cada conductor que tiene anticipos o rendiciones.

- Cada flete rendido deja un resultado: anticipos (vales de dinero) − gastos rendidos, igual que en las planillas. El saldo es la suma de esos resultados y se arrastra de un flete a otro.
- **A favor del conductor** (positivo): le sobró anticipo y lo usa en el próximo flete.
- **En contra del conductor** (negativo): gastó más de lo anticipado y puso dinero propio.
- No hay devoluciones ni transferencias aparte: el saldo se compensa con los anticipos siguientes.
- Los fletes sin rendición no mueven el saldo: sus vales aparecen como **anticipos por rendir**.
- Las **estadías** cuentan como un flete más: sus vales de dinero contra sus gastos.
- Haga clic en un conductor para ver su cuenta flete a flete, y en un flete para abrir su orden de retiro (o la estadía).

Los vales de combustible no entran en la cuenta: son combustible cargado, no dinero entregado al conductor.

## Informes

Solo muestran información: se calculan con los documentos emitidos y no se ingresa nada. Se filtran por **cliente** y por **día**, **entre días** o **mes**, y se descargan en **Excel** o **PDF**.

### Control de fletes

**Informes → Control de fletes**: una fila por flete (orden de carga no anulada), filtrada por la fecha de la orden de retiro, con las columnas de la planilla del cliente. Las **estadías** aparecen como filas sin cliente ni valor de flete (solo sus anticipos y gastos) cuando no se filtra por un cliente. Los botones **Por rendir** y **Rendidos** separan los fletes que aún no tienen rendición. Arriba están el valor de los fletes, el costo total, el margen y la rentabilidad del período; al pie de la grilla, la fila de totales, que también sale en el Excel y el PDF.

- **Distancia** y **Horómetro**: kilómetros y horas del motor del remolque según la rendición.
- **Litros camión**, **litros remolque** y **Combustible**: de los vales de combustible emitidos.
- **Km/Lt** = distancia / litros camión. **Lt/Hr** = litros remolque / horómetro.
- **Anticipo**: vales de dinero emitidos. Peajes, viático, carga-descarga, **petróleo** y otros gastos vienen de la rendición; **Total gastos** es su suma (el total de la rendición).
- **Saldo** = anticipo − total gastos (positivo: a favor del conductor, como en su cuenta).
- **Comisiones** = valor del flete × % de comisión del conductor.
- **Costo total** = total gastos + combustible + comisiones. **Margen** = valor flete − costo total. **Rentabilidad** = margen / valor flete.

Haga clic en un flete para abrir su rendición (o su orden de carga si aún no se rinde).

### Órdenes por facturar

**Informes → Órdenes por facturar**: órdenes de carga con guías del período (por fecha de carga), estén o no rendidas. Sin cliente elegido muestra el total a facturar de cada cliente; haga clic en uno (o elíjalo arriba) para ver el detalle con su razón social, RUT y período, y descargue el **informe** en PDF o Excel para facturar. Las guías de una orden con la misma tarifa van en una línea, con sus números separados por guion.

## Documentos: PDF, Excel y anulación

- Cada documento tiene botones **PDF** y **Excel** para descargarlo.
- Los listados de documentos se filtran por **día**, **entre días** o **mes** (por defecto, el mes actual).
- **Anular** requiere perfil Administrador y un motivo. Se anula del último documento al primero: rendición, luego orden de carga, luego vales y al final la orden de retiro. Al anular un documento, el anterior vuelve a quedar abierto.

### Corregir y eliminar (Administrador)

- El administrador puede **corregir** una orden de retiro cerrada o una orden de carga rendida; la pantalla avisa que el cambio queda en Auditoría. Los demás perfiles editan solo documentos abiertos.
- **Eliminar** borra el documento de forma permanente. Va del último al primero, como anular: una orden de retiro con orden de carga o vales no se puede eliminar hasta eliminar esos documentos. Para un error de digitación conviene anular, porque el documento sigue a la vista con su motivo.
- En los mantenedores (empresas, clientes, packings, móviles, conductores y tarifas), el botón **Eliminar** del formulario borra registros que nada usa. Si el registro tiene documentos o asignaciones, el sistema lo indica y hay que desactivarlo.
- Toda eliminación queda en Auditoría con una copia completa de los datos.

## Perfiles

| Perfil | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios, catálogos, parámetros, auditoría, anulaciones, eliminaciones y corrección de documentos cerrados |
| Operaciones | Mantenedores, órdenes de retiro y de carga, vales y rendiciones |
| Finanzas | Tarifas, vales de dinero y combustible, rendiciones |
| Solo lectura | Consultar y exportar |

## Administración

- **Usuarios**: crear cuentas, asignar perfil, desactivar o cambiar la contraseña de otro usuario.
- **Catálogos**: las listas de la hoja BaseDatos (ciudades, depósitos, trazabilidades, etc.). Tipos de móviles y categorías de empresa se pueden renombrar o desactivar, pero no ampliar, porque el sistema los usa en su lógica.
- **Parámetros**: datos de la empresa que aparecen en los PDF, valor del litro de combustible por defecto, concepto por defecto de los vales, días de anticipación de las alertas de vencimiento y N° de la primera hoja de ruta (**HOJA_RUTA_INICIAL**; al cambiarlo se renumeran todas).
- **Auditoría**: quién creó, modificó, anuló, asignó o eliminó cada registro y cuándo. Cada fila muestra el documento por su número (o el móvil por su patente, la persona por su nombre). Al hacer clic se ve el detalle: en una modificación, cada campo con su valor anterior y el nuevo; en una eliminación, la copia de todos los datos, incluidas las guías, viáticos y gastos. **Abrir registro** lleva al documento.
