import { esRutValido } from '@nexustrack/shared';
import { Prisma } from '../generated/prisma/client.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

/** Errores de negocio con mensajes en español listos para mostrar al usuario. */
export const noEncontrado = (que: string) =>
  new NotFoundException(`${que} no existe.`);
export const conflicto = (mensaje: string) => new ConflictException(mensaje);
export const invalido = (mensaje: string) => new BadRequestException(mensaje);

/** Exige dígito verificador correcto cuando el RUT es nuevo o cambió (permite editar registros
 *  importados con RUT erróneo sin obligar a corregirlo en ese momento). */
export function exigirRutValido(rut: string, anterior?: string | null): void {
  if (rut !== anterior && !esRutValido(rut)) {
    throw invalido(
      `El RUT ${rut} no es válido: el dígito verificador no corresponde.`,
    );
  }
}

/** Traduce el error de llave foránea al eliminar un registro que otros datos usan. */
export function enUso(error: unknown, mensaje: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  )
    throw conflicto(mensaje);
  throw error;
}

/** ["a", "b", "c"] → "a, b y c". */
export function enumerar(partes: string[]): string {
  return partes.length < 2
    ? (partes[0] ?? '')
    : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}
