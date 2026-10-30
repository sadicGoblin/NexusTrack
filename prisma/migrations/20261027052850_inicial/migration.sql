-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERACIONES', 'FINANZAS', 'LECTURA');

-- CreateEnum
CREATE TYPE "TipoCatalogo" AS ENUM ('CIUDAD', 'PUERTO_EMBARQUE', 'DEPOSITO', 'TRAZABILIDAD', 'TIPO_MOVIL', 'CATEGORIA_EMPRESA', 'UNIDAD_RUTA', 'ESPECIE', 'UM_ESPECIE', 'UM_TARIFA', 'SITIO_ENTREGA', 'FORMA_PAGO', 'TIPO_DOCUMENTO', 'ITEM_GASTO');

-- CreateEnum
CREATE TYPE "TipoConductor" AS ENUM ('TRABAJADOR', 'TERCERO');

-- CreateEnum
CREATE TYPE "EstadoOrdenRetiro" AS ENUM ('ABIERTA', 'CON_CARGA', 'CERRADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoOrdenCarga" AS ENUM ('ABIERTA', 'RENDIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('EMITIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoSecuencia" AS ENUM ('ORDEN_RETIRO', 'VALE_DINERO', 'ORDEN_CARGA', 'HOJA_RUTA', 'VALE_COMBUSTIBLE', 'RENDICION', 'PACKING', 'RUTA_TARIFA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenHash" TEXT,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cambios" JSONB,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secuencia" (
    "tipo" "TipoSecuencia" NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Secuencia_pkey" PRIMARY KEY ("tipo")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "CatalogoItem" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoCatalogo" NOT NULL,
    "valor" TEXT NOT NULL,
    "codigo" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "CatalogoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "propietario" TEXT,
    "fono" TEXT,
    "email" TEXT,
    "categoriaId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "giro" TEXT,
    "direccion" TEXT,
    "contactoOperaciones" TEXT,
    "contactoAdministrativo" TEXT,
    "fono" TEXT,
    "email" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Packing" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "clienteId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Packing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movil" (
    "id" SERIAL NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "tipoId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" INTEGER NOT NULL,
    "vencRevisionTecnica" DATE,
    "vencPermisoCirculacion" DATE,
    "vencSeguro" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Movil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conductor" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tipo" "TipoConductor" NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "comision" DOUBLE PRECISION,
    "numeroLicencia" TEXT,
    "vencLicencia" DATE,
    "fechaIngreso" DATE,
    "terminoContrato" DATE,
    "direccion" TEXT,
    "telefono" TEXT,
    "numeroCuenta" TEXT,
    "banco" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "camionId" INTEGER NOT NULL,
    "conductorId" INTEGER,
    "chasisId" INTEGER,
    "thermoId" INTEGER,
    "plataformaId" INTEGER,
    "fechaAsignacion" DATE NOT NULL,
    "fechaTermino" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaTarifa" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "tramo" TEXT NOT NULL,
    "distanciaKm" DOUBLE PRECISION,
    "valor" INTEGER NOT NULL,
    "vigenciaDesde" DATE,
    "vigenciaHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "RutaTarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenRetiro" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoOrdenRetiro" NOT NULL DEFAULT 'ABIERTA',
    "trazabilidadId" INTEGER NOT NULL,
    "conductorId" INTEGER NOT NULL,
    "camionId" INTEGER NOT NULL,
    "remolqueId" INTEGER,
    "tipoRemolque" TEXT,
    "empresaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "depositoRetiroId" INTEGER,
    "packingCargaId" INTEGER,
    "fechaCarga" DATE,
    "horaCarga" TEXT,
    "depositoEntregaId" INTEGER,
    "packingEntregaId" INTEGER,
    "destinoFinal" TEXT,
    "nave" TEXT,
    "mtb" TEXT,
    "booking" TEXT,
    "puertoEmbarqueId" INTEGER,
    "fechaEmbarque" DATE,
    "horaEmbarque" TEXT,
    "opNumero" TEXT,
    "ordenCompra" TEXT,
    "observaciones" TEXT,
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "OrdenRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValeDinero" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "ordenRetiroId" INTEGER NOT NULL,
    "fechaEntrega" DATE NOT NULL,
    "concepto" TEXT NOT NULL DEFAULT 'FLETE',
    "glosa" TEXT,
    "sitioEntregaId" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,
    "formaPagoId" INTEGER NOT NULL,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'EMITIDO',
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "ValeDinero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCarga" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "ordenRetiroId" INTEGER NOT NULL,
    "estado" "EstadoOrdenCarga" NOT NULL DEFAULT 'ABIERTA',
    "tramoId" INTEGER,
    "fechaCarga" DATE NOT NULL,
    "horaCarga" TEXT,
    "packingCargaId" INTEGER,
    "patenteCamion" TEXT NOT NULL,
    "patenteRemolque" TEXT,
    "hojaRuta" INTEGER,
    "guiasConfirmadas" TIMESTAMP(3),
    "totalNeto" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "OrdenCarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuiaFlete" (
    "id" SERIAL NOT NULL,
    "ordenCargaId" INTEGER NOT NULL,
    "linea" INTEGER NOT NULL,
    "numeroGuia" TEXT NOT NULL,
    "fechaGuia" DATE NOT NULL,
    "especieId" INTEGER,
    "umEspecieId" INTEGER,
    "cantidadEspecie" DOUBLE PRECISION,
    "numeroContenedor" TEXT,
    "tramoId" INTEGER NOT NULL,
    "tramoTexto" TEXT NOT NULL,
    "umTarifaId" INTEGER,
    "cantidadTarifa" DOUBLE PRECISION NOT NULL,
    "valorUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "GuiaFlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValeCombustible" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "ordenRetiroId" INTEGER NOT NULL,
    "fechaEntrega" DATE NOT NULL,
    "horaEntrega" TEXT,
    "sitioEntregaId" INTEGER NOT NULL,
    "formaPagoId" INTEGER,
    "tipoDocumentoId" INTEGER,
    "camionId" INTEGER NOT NULL,
    "remolqueId" INTEGER,
    "numeralInicialCamion" DOUBLE PRECISION,
    "numeralFinalCamion" DOUBLE PRECISION,
    "numeralInicialRemolque" DOUBLE PRECISION,
    "numeralFinalRemolque" DOUBLE PRECISION,
    "litrosCamion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "litrosRemolque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLitros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorLitro" INTEGER NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'EMITIDO',
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "ValeCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rendicion" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "ordenCargaId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaSalida" DATE,
    "horaSalida" TEXT,
    "fechaLlegada" DATE,
    "horaLlegada" TEXT,
    "odometroInicial" INTEGER,
    "odometroFinal" INTEGER,
    "kmRecorridos" INTEGER,
    "observaciones" TEXT,
    "fechaEntrega" DATE,
    "sitioEntregaId" INTEGER,
    "peajes" INTEGER NOT NULL DEFAULT 0,
    "carga" INTEGER NOT NULL DEFAULT 0,
    "descarga" INTEGER NOT NULL DEFAULT 0,
    "totalViaticos" INTEGER NOT NULL DEFAULT 0,
    "totalOtrosGastos" INTEGER NOT NULL DEFAULT 0,
    "totalGeneral" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'EMITIDO',
    "motivoAnulacion" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "actualizadoPorId" INTEGER,

    CONSTRAINT "Rendicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendicionViatico" (
    "id" SERIAL NOT NULL,
    "rendicionId" INTEGER NOT NULL,
    "linea" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "desayuno" INTEGER NOT NULL DEFAULT 0,
    "almuerzo" INTEGER NOT NULL DEFAULT 0,
    "comida" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RendicionViatico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendicionGasto" (
    "id" SERIAL NOT NULL,
    "rendicionId" INTEGER NOT NULL,
    "linea" INTEGER NOT NULL,
    "tipoDocumentoId" INTEGER,
    "numeroDocumento" TEXT,
    "rutProveedor" TEXT,
    "fecha" DATE,
    "monto" INTEGER NOT NULL,
    "itemGastoId" INTEGER,
    "observaciones" TEXT,

    CONSTRAINT "RendicionGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_fecha_idx" ON "Auditoria"("fecha");

-- CreateIndex
CREATE INDEX "CatalogoItem_tipo_orden_idx" ON "CatalogoItem"("tipo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoItem_tipo_valor_key" ON "CatalogoItem"("tipo", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_rut_key" ON "Cliente"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "Packing_codigo_key" ON "Packing"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Movil_patente_key" ON "Movil"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "Conductor_rut_key" ON "Conductor"("rut");

-- CreateIndex
CREATE INDEX "Asignacion_camionId_fechaTermino_idx" ON "Asignacion"("camionId", "fechaTermino");

-- CreateIndex
CREATE UNIQUE INDEX "RutaTarifa_codigo_key" ON "RutaTarifa"("codigo");

-- CreateIndex
CREATE INDEX "RutaTarifa_clienteId_idx" ON "RutaTarifa"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenRetiro_numero_key" ON "OrdenRetiro"("numero");

-- CreateIndex
CREATE INDEX "OrdenRetiro_fecha_idx" ON "OrdenRetiro"("fecha");

-- CreateIndex
CREATE INDEX "OrdenRetiro_estado_idx" ON "OrdenRetiro"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "ValeDinero_numero_key" ON "ValeDinero"("numero");

-- CreateIndex
CREATE INDEX "ValeDinero_fechaEntrega_idx" ON "ValeDinero"("fechaEntrega");

-- CreateIndex
CREATE INDEX "ValeDinero_ordenRetiroId_idx" ON "ValeDinero"("ordenRetiroId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCarga_numero_key" ON "OrdenCarga"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCarga_hojaRuta_key" ON "OrdenCarga"("hojaRuta");

-- CreateIndex
CREATE INDEX "OrdenCarga_fechaCarga_idx" ON "OrdenCarga"("fechaCarga");

-- CreateIndex
CREATE INDEX "OrdenCarga_ordenRetiroId_idx" ON "OrdenCarga"("ordenRetiroId");

-- CreateIndex
CREATE INDEX "GuiaFlete_ordenCargaId_idx" ON "GuiaFlete"("ordenCargaId");

-- CreateIndex
CREATE UNIQUE INDEX "ValeCombustible_numero_key" ON "ValeCombustible"("numero");

-- CreateIndex
CREATE INDEX "ValeCombustible_fechaEntrega_idx" ON "ValeCombustible"("fechaEntrega");

-- CreateIndex
CREATE INDEX "ValeCombustible_ordenRetiroId_idx" ON "ValeCombustible"("ordenRetiroId");

-- CreateIndex
CREATE UNIQUE INDEX "Rendicion_numero_key" ON "Rendicion"("numero");

-- CreateIndex
CREATE INDEX "Rendicion_fecha_idx" ON "Rendicion"("fecha");

-- CreateIndex
CREATE INDEX "Rendicion_ordenCargaId_idx" ON "Rendicion"("ordenCargaId");

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Packing" ADD CONSTRAINT "Packing_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movil" ADD CONSTRAINT "Movil_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movil" ADD CONSTRAINT "Movil_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conductor" ADD CONSTRAINT "Conductor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Movil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_chasisId_fkey" FOREIGN KEY ("chasisId") REFERENCES "Movil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_thermoId_fkey" FOREIGN KEY ("thermoId") REFERENCES "Movil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Movil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaTarifa" ADD CONSTRAINT "RutaTarifa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaTarifa" ADD CONSTRAINT "RutaTarifa_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaTarifa" ADD CONSTRAINT "RutaTarifa_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaTarifa" ADD CONSTRAINT "RutaTarifa_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_trazabilidadId_fkey" FOREIGN KEY ("trazabilidadId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Movil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_remolqueId_fkey" FOREIGN KEY ("remolqueId") REFERENCES "Movil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_depositoRetiroId_fkey" FOREIGN KEY ("depositoRetiroId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_packingCargaId_fkey" FOREIGN KEY ("packingCargaId") REFERENCES "Packing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_depositoEntregaId_fkey" FOREIGN KEY ("depositoEntregaId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_packingEntregaId_fkey" FOREIGN KEY ("packingEntregaId") REFERENCES "Packing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenRetiro" ADD CONSTRAINT "OrdenRetiro_puertoEmbarqueId_fkey" FOREIGN KEY ("puertoEmbarqueId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeDinero" ADD CONSTRAINT "ValeDinero_ordenRetiroId_fkey" FOREIGN KEY ("ordenRetiroId") REFERENCES "OrdenRetiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeDinero" ADD CONSTRAINT "ValeDinero_sitioEntregaId_fkey" FOREIGN KEY ("sitioEntregaId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeDinero" ADD CONSTRAINT "ValeDinero_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCarga" ADD CONSTRAINT "OrdenCarga_ordenRetiroId_fkey" FOREIGN KEY ("ordenRetiroId") REFERENCES "OrdenRetiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCarga" ADD CONSTRAINT "OrdenCarga_tramoId_fkey" FOREIGN KEY ("tramoId") REFERENCES "RutaTarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCarga" ADD CONSTRAINT "OrdenCarga_packingCargaId_fkey" FOREIGN KEY ("packingCargaId") REFERENCES "Packing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaFlete" ADD CONSTRAINT "GuiaFlete_ordenCargaId_fkey" FOREIGN KEY ("ordenCargaId") REFERENCES "OrdenCarga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaFlete" ADD CONSTRAINT "GuiaFlete_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaFlete" ADD CONSTRAINT "GuiaFlete_umEspecieId_fkey" FOREIGN KEY ("umEspecieId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaFlete" ADD CONSTRAINT "GuiaFlete_tramoId_fkey" FOREIGN KEY ("tramoId") REFERENCES "RutaTarifa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaFlete" ADD CONSTRAINT "GuiaFlete_umTarifaId_fkey" FOREIGN KEY ("umTarifaId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_ordenRetiroId_fkey" FOREIGN KEY ("ordenRetiroId") REFERENCES "OrdenRetiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_sitioEntregaId_fkey" FOREIGN KEY ("sitioEntregaId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Movil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValeCombustible" ADD CONSTRAINT "ValeCombustible_remolqueId_fkey" FOREIGN KEY ("remolqueId") REFERENCES "Movil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_ordenCargaId_fkey" FOREIGN KEY ("ordenCargaId") REFERENCES "OrdenCarga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_sitioEntregaId_fkey" FOREIGN KEY ("sitioEntregaId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendicionViatico" ADD CONSTRAINT "RendicionViatico_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendicionGasto" ADD CONSTRAINT "RendicionGasto_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendicionGasto" ADD CONSTRAINT "RendicionGasto_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendicionGasto" ADD CONSTRAINT "RendicionGasto_itemGastoId_fkey" FOREIGN KEY ("itemGastoId") REFERENCES "CatalogoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en el esquema: una sola asignación vigente
-- (fechaTermino nula) por camión, por conductor y por remolque.
CREATE UNIQUE INDEX "Asignacion_camion_vigente_key" ON "Asignacion"("camionId") WHERE "fechaTermino" IS NULL;
CREATE UNIQUE INDEX "Asignacion_conductor_vigente_key" ON "Asignacion"("conductorId") WHERE "fechaTermino" IS NULL AND "conductorId" IS NOT NULL;
CREATE UNIQUE INDEX "Asignacion_chasis_vigente_key" ON "Asignacion"("chasisId") WHERE "fechaTermino" IS NULL AND "chasisId" IS NOT NULL;
CREATE UNIQUE INDEX "Asignacion_thermo_vigente_key" ON "Asignacion"("thermoId") WHERE "fechaTermino" IS NULL AND "thermoId" IS NOT NULL;
CREATE UNIQUE INDEX "Asignacion_plataforma_vigente_key" ON "Asignacion"("plataformaId") WHERE "fechaTermino" IS NULL AND "plataformaId" IS NOT NULL;

-- Una sola orden de carga no anulada por orden de retiro, y una sola rendición
-- emitida por orden de carga.
CREATE UNIQUE INDEX "OrdenCarga_retiro_activa_key" ON "OrdenCarga"("ordenRetiroId") WHERE "estado" <> 'ANULADA';
CREATE UNIQUE INDEX "Rendicion_carga_emitida_key" ON "Rendicion"("ordenCargaId") WHERE "estado" = 'EMITIDO';

-- Correlativos de documentos.
INSERT INTO "Secuencia" ("tipo", "ultimo") VALUES
  ('ORDEN_RETIRO', 0), ('VALE_DINERO', 0), ('ORDEN_CARGA', 0), ('HOJA_RUTA', 0),
  ('VALE_COMBUSTIBLE', 0), ('RENDICION', 0), ('PACKING', 0), ('RUTA_TARIFA', 0);
