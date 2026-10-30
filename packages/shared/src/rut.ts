/**
 * Utilidades de RUT chileno (validación módulo 11 y formato 12.345.678-9).
 */

/** Quita puntos, guiones y espacios; deja el dígito verificador en mayúscula. */
export function limpiarRut(rut: string): string {
  return (rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/** Calcula el dígito verificador de un cuerpo de RUT numérico. */
export function calcularDvRut(cuerpo: string | number): string {
  const digitos = String(cuerpo).replace(/\D/g, '');
  let suma = 0;
  let multiplicador = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    suma += Number(digitos[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function esRutValido(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return calcularDvRut(cuerpo) === dv;
}

/** Devuelve el RUT con puntos y guion (12.345.678-9). Si no es interpretable, lo devuelve tal cual. */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return rut;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return rut;
  return `${Number(cuerpo).toLocaleString('es-CL').replace(/,/g, '.')}-${dv}`;
}
