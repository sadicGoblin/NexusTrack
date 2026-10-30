/** Conversión entre fechas ISO (AAAA-MM-DD) que usa la API y objetos Date que usan los calendarios. */
export function isoADate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

export function dateAIso(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}
