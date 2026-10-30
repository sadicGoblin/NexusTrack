import {
  formatearFecha,
  formatearNumero,
  formatearPesos,
  formatearPorcentaje,
  type TipoColumna,
} from '@nexustrack/shared';

/** Representación de texto de un valor según su tipo (para PDF). */
export function formatear(valor: unknown, tipo: TipoColumna = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return '';
  switch (tipo) {
    case 'fecha':
      return formatearFecha(String(valor));
    case 'pesos':
      return formatearPesos(Number(valor));
    case 'numero':
      return formatearNumero(Number(valor), 0);
    case 'decimal':
      return formatearNumero(
        Number(valor),
        Number.isInteger(Number(valor)) ? 0 : 2,
      );
    case 'porcentaje':
      return formatearPorcentaje(Number(valor), 1).replace(',0 %', ' %');
    case 'booleano':
      return valor ? 'Sí' : 'No';
    default:
      return String(valor);
  }
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const alinearDerecha = (tipo?: TipoColumna) =>
  tipo === 'pesos' ||
  tipo === 'numero' ||
  tipo === 'decimal' ||
  tipo === 'porcentaje';
