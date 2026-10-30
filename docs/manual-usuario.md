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

## Mantenedores

Empresas, clientes, packings, móviles, conductores y rutas y tarifas se manejan igual: botón **Nuevo** arriba a la derecha y clic en una fila para editar. Los registros no se borran: se desactivan con el interruptor **Activo**.

- **RUT**: se escribe con o sin puntos; el sistema lo formatea y valida el dígito verificador.
- **Móviles**: las fechas de vencimiento en rojo están vencidas y en ámbar vencen en 30 días o menos. El tipo de empresa se toma de la empresa elegida.
- **Conductores**: al elegir la empresa se sugiere el tipo (trabajador si la empresa es socia, tercero en otro caso). El % de comisión se escribe como porcentaje, por ejemplo 8.
- **Packings y rutas**: si deja el código vacío, el sistema asigna PK-001 o RT-001.
- **Rutas y tarifas**: el tramo se arma solo con origen, destino y unidad. La vigencia define en qué fechas se ofrece la tarifa.

### Asignaciones

Muestra cada camión con su conductor y remolques vigentes. Es lo que permite completar automáticamente las órdenes de retiro, por eso conviene mantenerla al día.

- Clic en la fila o en el lápiz para cambiar la asignación. La anterior se cierra con la fecha indicada y queda en el **historial**.
- Los remolques o conductores que ya están en otro camión aparecen marcados ("en RHGC58"). Libere primero ese camión con la **X**.

## Flujo de un flete

### 1. Orden de retiro

**Operación → Órdenes de retiro → Nueva orden de retiro.**

Al elegir el **conductor**, el sistema completa empresa, camión y remolque según su asignación vigente. Puede cambiarlos. Al elegir otro camión, se propone su remolque. Al presionar **Emitir** se asigna el número correlativo.

Desde la orden de retiro se crean los demás documentos, en la sección **Documentos del flete**.

### 2. Orden de carga

Botón **Crear orden de carga** en la orden de retiro, o **Órdenes de carga → Nueva** y elegir la orden de retiro en la lista.

- El **tramo** solo ofrece tarifas del cliente vigentes a la fecha de carga. Marque "Mostrar tarifas vencidas" si necesita una tarifa antigua.
- En **Guías del flete**, cada fila es una guía y un tramo. Al elegir el tramo se propone su valor unitario, que puede modificar. **Agregar guía** copia los datos de la fila anterior.
- Al guardar con al menos una guía se asigna el **N° de hoja de ruta**.

### 3. Vale de dinero

Anticipo para el viaje. Se crea desde la orden de retiro o desde **Vales de dinero → Nuevo**. El concepto por defecto es FLETE.

### 4. Vale de combustible

Se emite al terminar el flete. Las patentes vienen de la orden de retiro. Ingrese los numerales inicial y final de la bomba; los litros y el total se calculan solos. El valor del litro viene de Parámetros y se puede cambiar en cada vale.

### 5. Rendición

Desde la orden de carga, botón **Crear rendición**, o **Rendiciones → Nueva**. Solo aparecen órdenes de carga con guías registradas.

Complete salida, llegada y odómetros (los kilómetros se calculan solos), peajes, carga y descarga, los **viáticos** por día y los **otros gastos** con su documento. Al emitir la rendición, la orden de carga queda **Rendida** y la orden de retiro **Cerrada**.

## Documentos: PDF, Excel y anulación

- Cada documento tiene botones **PDF** y **Excel** para descargarlo.
- Los listados de documentos se filtran por **día**, **entre días** o **mes** (por defecto, el mes actual).
- **Anular** requiere perfil Administrador y un motivo. Se anula del último documento al primero: rendición, luego orden de carga, luego vales y al final la orden de retiro. Al anular un documento, el anterior vuelve a quedar abierto.

## Perfiles

| Perfil | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios, catálogos, parámetros, auditoría y anulaciones |
| Operaciones | Mantenedores, órdenes de retiro y de carga, vales y rendiciones |
| Finanzas | Tarifas, vales de dinero y combustible, rendiciones |
| Solo lectura | Consultar y exportar |

## Administración

- **Usuarios**: crear cuentas, asignar perfil, desactivar o cambiar la contraseña de otro usuario.
- **Catálogos**: las listas de la hoja BaseDatos (ciudades, depósitos, trazabilidades, etc.). Tipos de móviles y categorías de empresa se pueden renombrar o desactivar, pero no ampliar, porque el sistema los usa en su lógica.
- **Parámetros**: datos de la empresa que aparecen en los PDF, valor del litro de combustible por defecto, concepto por defecto de los vales y días de anticipación de las alertas de vencimiento.
- **Auditoría**: quién creó, modificó o anuló cada registro, con el detalle de los cambios.
