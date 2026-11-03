-- Estadías (rendiciones sin orden de carga), vales de dinero de estadías y N° de hoja de ruta
-- por fecha (ver docs/decisiones.md §16).

-- CreateEnum
CREATE TYPE "TipoRendicion" AS ENUM ('FLETE', 'ESTADIA');

-- La hoja de ruta se renumera por fecha: el índice único impediría correr los números en bloque.
DROP INDEX "OrdenCarga_hojaRuta_key";

-- AlterTable
ALTER TABLE "Rendicion" ADD COLUMN     "camionId" INTEGER,
ADD COLUMN     "conductorId" INTEGER,
ADD COLUMN     "destinoId" INTEGER,
ADD COLUMN     "hojaRuta" INTEGER,
ADD COLUMN     "remolqueId" INTEGER,
ADD COLUMN     "tipo" "TipoRendicion" NOT NULL DEFAULT 'FLETE',
ALTER COLUMN "ordenCargaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ValeDinero" ADD COLUMN     "estadiaId" INTEGER,
ALTER COLUMN "ordenRetiroId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "OrdenCarga_hojaRuta_idx" ON "OrdenCarga"("hojaRuta");

-- CreateIndex
CREATE INDEX "Rendicion_tipo_fechaSalida_idx" ON "Rendicion"("tipo", "fechaSalida");

-- CreateIndex
CREATE INDEX "Rendicion_conductorId_idx" ON "Rendicion"("conductorId");

-- CreateIndex
CREATE INDEX "ValeDinero_estadiaId_idx" ON "ValeDinero"("estadiaId");

-- AddForeignKey
ALTER TABLE "ValeDinero" ADD CONSTRAINT "ValeDinero_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "Rendicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Movil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_remolqueId_fkey" FOREIGN KEY ("remolqueId") REFERENCES "Movil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "CatalogoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un flete tiene orden de carga; una estadía, conductor, camión, lugar y fecha de inicio.
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_tipo_check" CHECK (
  ("tipo" = 'FLETE' AND "ordenCargaId" IS NOT NULL)
  OR ("tipo" = 'ESTADIA' AND "ordenCargaId" IS NULL AND "conductorId" IS NOT NULL
      AND "camionId" IS NOT NULL AND "destinoId" IS NOT NULL AND "fechaSalida" IS NOT NULL)
);

-- Un vale de dinero es anticipo de una orden de retiro o de una estadía, nunca de ambas.
ALTER TABLE "ValeDinero" ADD CONSTRAINT "ValeDinero_destino_check"
  CHECK (num_nonnulls("ordenRetiroId", "estadiaId") = 1);

INSERT INTO "Parametro" ("clave", "valor", "descripcion", "actualizadoEn")
VALUES ('HOJA_RUTA_INICIAL', '1',
        'N° de la primera hoja de ruta (para continuar la numeración de la planilla).', now())
ON CONFLICT ("clave") DO NOTHING;

-- N° de hoja de ruta = posición por fecha entre las órdenes de carga no anuladas con guías (fecha
-- y hora de carga) y las estadías emitidas (fecha y hora de inicio), a partir de HOJA_RUTA_INICIAL.
-- En un mismo día y hora, por orden de ingreso. Las anuladas quedan sin número. Devuelve cuántos
-- documentos cambiaron. La API la llama en la misma transacción que guarda, anula o elimina.
CREATE FUNCTION renumerar_hojas_ruta() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  base integer;
  cambios integer;
BEGIN
  -- Serializa la renumeración entre transacciones (la API lo toma también al empezar).
  PERFORM pg_advisory_xact_lock(hashtext('hoja_ruta'));
  SELECT NULLIF(regexp_replace(valor, '\D', '', 'g'), '')::integer INTO base
    FROM "Parametro" WHERE clave = 'HOJA_RUTA_INICIAL';
  base := COALESCE(base, 1);

  WITH hojas AS (
    SELECT 'C' AS tipo, oc.id, oc."fechaCarga" AS fecha, oc."horaCarga" AS hora, oc."creadoEn"
      FROM "OrdenCarga" oc
     WHERE oc.estado <> 'ANULADA'
       AND EXISTS (SELECT 1 FROM "GuiaFlete" g WHERE g."ordenCargaId" = oc.id)
    UNION ALL
    SELECT 'E', r.id, r."fechaSalida", r."horaSalida", r."creadoEn"
      FROM "Rendicion" r
     WHERE r.tipo = 'ESTADIA' AND r.estado = 'EMITIDO'
  ), numeradas AS (
    SELECT tipo, id,
           (base - 1 + ROW_NUMBER() OVER (ORDER BY fecha, hora NULLS LAST, "creadoEn", tipo, id))::integer AS n
      FROM hojas
  ), cargas AS (
    UPDATE "OrdenCarga" oc SET "hojaRuta" = h.n
      FROM "OrdenCarga" o LEFT JOIN numeradas h ON h.tipo = 'C' AND h.id = o.id
     WHERE o.id = oc.id AND oc."hojaRuta" IS DISTINCT FROM h.n
    RETURNING 1
  ), estadias AS (
    UPDATE "Rendicion" r SET "hojaRuta" = h.n
      FROM "Rendicion" x LEFT JOIN numeradas h ON h.tipo = 'E' AND h.id = x.id
     WHERE x.id = r.id AND r."hojaRuta" IS DISTINCT FROM h.n
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM cargas) + (SELECT count(*) FROM estadias) INTO cambios;
  RETURN cambios;
END $$;

-- Las hojas de ruta existentes pasan a numerarse por fecha de carga.
SELECT renumerar_hojas_ruta();
