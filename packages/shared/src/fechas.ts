/**
 * Fechas de negocio como texto ISO (AAAA-MM-DD), interpretadas en hora de Chile.
 */

export const ZONA_HORARIA = 'America/Santiago';

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !ISO_FECHA.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

export function esHora(valor: unknown): valor is string {
  return typeof valor === 'string' && HORA.test(valor);
}

/** Fecha de hoy en Chile como AAAA-MM-DD. */
export function hoyIso(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** AAAA-MM-DD a DD/MM/AAAA. Acepta también un ISO completo (toma los 10 primeros caracteres). */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}

/** Suma días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (hasta - desde). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Primer y último día de un mes (mes 1-12). */
export function rangoMes(anio: number, mes: number): { desde: string; hasta: string } {
  const desde = new Date(Date.UTC(anio, mes - 1, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return { desde, hasta };
}
