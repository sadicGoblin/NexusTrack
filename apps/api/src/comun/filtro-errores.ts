import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** Mensajes para restricciones únicas, incluidas las parciales definidas en la migración. */
const UNICOS: [RegExp, string][] = [
  [/Asignacion_camion_vigente/, 'El camión ya tiene una asignación vigente.'],
  [
    /Asignacion_conductor_vigente/,
    'El conductor ya está asignado a otro camión. Libérelo primero.',
  ],
  [
    /Asignacion_chasis_vigente/,
    'El chasis ya está asignado a otro camión. Libérelo primero.',
  ],
  [
    /Asignacion_thermo_vigente/,
    'El thermo ya está asignado a otro camión. Libérelo primero.',
  ],
  [
    /Asignacion_plataforma_vigente/,
    'La plataforma ya está asignada a otro camión. Libérela primero.',
  ],
  [
    /OrdenCarga_retiro_activa/,
    'La orden de retiro ya tiene una orden de carga vigente.',
  ],
  [
    /Rendicion_carga_emitida/,
    'La orden de carga ya tiene una rendición emitida.',
  ],
  [/tipo.*valor|valor.*tipo/, 'Ya existe un valor igual en este catálogo.'],
  [/rut/i, 'Ya existe un registro con ese RUT.'],
  [/patente/i, 'Ya existe un móvil con esa patente.'],
  [/codigo/i, 'Ya existe un registro con ese código.'],
  [/email/i, 'Ya existe un usuario con ese correo.'],
  [/numero|hojaRuta/i, 'El correlativo ya fue utilizado. Intente nuevamente.'],
];

/**
 * Traduce errores de base de datos a respuestas HTTP con mensajes en español.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class FiltroErroresPrisma implements ExceptionFilter {
  private readonly logger = new Logger('BaseDeDatos');

  catch(
    error: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const res = host.switchToHttp().getResponse<Response>();
    const detalle = JSON.stringify(error.meta ?? {}) + error.message;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error inesperado de base de datos.';

    switch (error.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message =
          UNICOS.find(([re]) => re.test(detalle))?.[1] ??
          'Ya existe un registro con esos datos.';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'El registro solicitado no existe.';
        break;
      case 'P2003':
        status = HttpStatus.CONFLICT;
        message =
          'Una referencia indicada no existe o el registro está siendo usado por otros datos.';
        break;
      default:
        this.logger.error(`${error.code}: ${error.message}`);
    }
    res.status(status).json({ statusCode: status, message });
  }
}
