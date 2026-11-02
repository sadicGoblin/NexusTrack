-- AlterTable
ALTER TABLE "Rendicion" ADD COLUMN     "horasMotor" DOUBLE PRECISION,
ADD COLUMN     "horometroFinal" DOUBLE PRECISION,
ADD COLUMN     "horometroInicial" DOUBLE PRECISION,
ADD COLUMN     "petroleo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remolqueConMotor" BOOLEAN;
