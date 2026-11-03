import type { Tx } from '../prisma/prisma.service.js';

/**
 * El N° de hoja de ruta es la posición por fecha entre fletes con guías y estadías (función
 * renumerar_hojas_ruta, en la migración 20261103120000). Toda transacción que la cambie toma este
 * bloqueo al empezar, antes de tocar filas: si lo tomara al final, dos transacciones podrían
 * esperarse mutuamente (una con el bloqueo y la otra con las filas que hay que renumerar).
 */
export async function reservarHojasRuta(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hoja_ruta'))`;
}

/** Recalcula los N° de hoja de ruta; se llama al final de la misma transacción. */
export async function renumerarHojasRuta(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT renumerar_hojas_ruta()`;
}
