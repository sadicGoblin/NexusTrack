import { ZONA_HORARIA } from '@nexustrack/shared';

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

/** Diferencia entre la hora de Chile y UTC en ese instante, en milisegundos (−3 h en verano). */
function desfaseChile(instante: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_HORARIA,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instante))
      .map((x) => [x.type, Number(x.value)]),
  );
  const comoUtc = Date.UTC(
    p['year']!,
    p['month']! - 1,
    p['day']!,
    p['hour']!,
    p['minute']!,
    p['second']!,
  );
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/** Fecha y hora de Chile ("AAAA-MM-DDTHH:mm") como instante, con el horario de verano que rija. */
export function chileAUtc(fechaHora: string): Date {
  const [a, m, d, h, min] = fechaHora.split(/[-T:]/).map(Number);
  const local = Date.UTC(a!, m! - 1, d!, h!, min!);
  // El desfase depende del instante: se calcula con una primera aproximación y se corrige.
  const aprox = local - desfaseChile(local);
  return new Date(local - desfaseChile(aprox));
}
