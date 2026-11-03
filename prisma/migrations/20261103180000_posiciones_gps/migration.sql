-- Posiciones GPS capturadas cada minuto para el historial de recorridos (docs/decisiones.md §17).

-- CreateTable
CREATE TABLE "PosicionGps" (
    "vehiculoId" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "velocidad" DOUBLE PRECISION,
    "encendido" SMALLINT,
    "odometro" DOUBLE PRECISION,

    CONSTRAINT "PosicionGps_pkey" PRIMARY KEY ("vehiculoId","fecha")
);

-- CreateIndex
CREATE INDEX "PosicionGps_fecha_idx" ON "PosicionGps"("fecha");

