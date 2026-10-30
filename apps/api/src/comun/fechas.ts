/**
 * Conversión entre fechas de negocio (texto AAAA-MM-DD) y columnas @db.Date (Date a medianoche UTC).
 */
export function aFecha(iso: string | null | undefined): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`) : null;
}

export function aIso(fecha: Date | null | undefined): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

/** Filtro Prisma para un rango de fechas opcional. */
export function rangoFechas(
  desde?: string,
  hasta?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!desde && !hasta) return undefined;
  return {
    ...(desde ? { gte: aFecha(desde)! } : {}),
    ...(hasta ? { lte: aFecha(hasta)! } : {}),
  };
}
