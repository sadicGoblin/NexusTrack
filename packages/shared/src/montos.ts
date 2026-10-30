/**
 * Formato de montos y números en convención chilena.
 */

const PESOS = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/** 565000 → "$565.000" (mismo formato que los campos de moneda de la interfaz). */
export function formatearPesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
  const signo = valor < 0 ? '-' : '';
  return `${signo}$${PESOS.format(Math.abs(Math.round(valor)))}`;
}

/** 374 → "374,0" con los decimales indicados. */
export function formatearNumero(valor: number | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

/** 0.08 → "8 %". */
export function formatearPorcentaje(fraccion: number | null | undefined, decimales = 0): string {
  if (fraccion === null || fraccion === undefined || Number.isNaN(fraccion)) return '';
  return `${formatearNumero(fraccion * 100, decimales)} %`;
}

/** Redondeo a n decimales sin errores de coma flotante visibles. */
export function redondear(valor: number, decimales = 0): number {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}
