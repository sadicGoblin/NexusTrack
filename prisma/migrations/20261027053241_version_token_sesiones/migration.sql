/*
  Warnings:

  - You are about to drop the column `refreshTokenHash` on the `Usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "refreshTokenHash",
ADD COLUMN     "versionToken" INTEGER NOT NULL DEFAULT 0;
