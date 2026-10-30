import { esRutValido } from '@nexustrack/shared';
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
