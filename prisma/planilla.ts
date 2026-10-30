/** Lectura de planillas Excel: textos limpios, números, fechas y tablas con encabezado. */
import type ExcelJS from 'exceljs';

export type Celda = ExcelJS.CellValue;

export function texto(valor: Celda): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if ('richText' in valor)
      return valor.richText
        .map((r) => r.text)
        .join('')
        .trim();
    if ('text' in valor) return String(valor.text).trim();
    if ('result' in valor) return texto(valor.result as Celda);
    return '';
  }
  return String(valor).replace(/\s+/g, ' ').trim();
}

export function numero(valor: Celda): number | null {
  if (typeof valor === 'number') return valor;
  const t = texto(valor)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return t ? Number(t) : null;
}

export function fecha(valor: Celda): Date | null {
  if (valor instanceof Date)
    return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
  const t = texto(valor);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

/** Mayúsculas, sin tildes, sin puntuación y con espacios simples: para comparar nombres. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9&/ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textoONulo(valor: Celda): string | null {
  return texto(valor) || null;
}

/** Lee una tabla buscando la fila cuyo contenido incluye `encabezado`; termina en la primera fila vacía. */
export function leerTabla(ws: ExcelJS.Worksheet, encabezado: string): Record<string, Celda>[] {
  let filaEncabezado = 0;
  const columnas = new Map<number, string>();
  ws.eachRow((row, n) => {
    if (filaEncabezado) return;
    row.eachCell((cell) => {
      if (texto(cell.value) === encabezado) filaEncabezado = n;
    });
    if (filaEncabezado) row.eachCell((cell, col) => columnas.set(col, texto(cell.value)));
  });
  if (!filaEncabezado) throw new Error(`No se encontró el encabezado "${encabezado}" en la hoja ${ws.name}`);
  const filas: Record<string, Celda>[] = [];
  for (let n = filaEncabezado + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const fila: Record<string, Celda> = {};
    let vacia = true;
    for (const [col, nombre] of columnas) {
      const v = row.getCell(col).value;
      fila[nombre] = v;
      if (texto(v)) vacia = false;
    }
    if (vacia) break;
    filas.push(fila);
  }
  return filas;
}
