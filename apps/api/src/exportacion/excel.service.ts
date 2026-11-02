import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type {
  ColumnaExportacion,
  ExportarTablaInput,
  TipoColumna,
} from '@nexustrack/shared';
import type {
  DatosEmisor,
  DocumentoImprimible,
  InformeImprimible,
  TablaImprimible,
} from './tipos.js';

const AZUL = 'FF0F4C81';
const FUENTE = 'Arial';

const FORMATOS: Partial<Record<TipoColumna, string>> = {
  pesos: '"$" #,##0;[Red]-"$" #,##0',
  numero: '#,##0',
  decimal: '#,##0.##',
  porcentaje: '0.0%',
  fecha: 'dd/mm/yyyy',
};

/** Valor tipado para Excel: fechas como Date, montos como número, booleanos como Sí/No. */
function valorCelda(
  valor: unknown,
  tipo: TipoColumna = 'texto',
): ExcelJS.CellValue {
  if (valor === null || valor === undefined || valor === '') return null;
  switch (tipo) {
    case 'fecha': {
      const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number);
      return a && m && d ? new Date(Date.UTC(a, m - 1, d)) : String(valor);
    }
    case 'pesos':
    case 'numero':
    case 'decimal':
    case 'porcentaje':
      return Number(valor);
    case 'booleano':
      return valor ? 'Sí' : 'No';
    default:
      return String(valor);
  }
}

@Injectable()
export class ExcelService {
  private libro(): ExcelJS.Workbook {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'NexusTrack';
    libro.created = new Date();
    return libro;
  }

  private encabezado(
    hoja: ExcelJS.Worksheet,
    emisor: DatosEmisor,
    titulo: string,
    subtitulo: string,
    columnas: number,
  ) {
    hoja.addRow([emisor.nombre]).font = {
      name: FUENTE,
      bold: true,
      size: 13,
      color: { argb: AZUL },
    };
    hoja.addRow([titulo]).font = { name: FUENTE, bold: true, size: 12 };
    hoja.addRow([subtitulo]).font = {
      name: FUENTE,
      size: 9,
      color: { argb: 'FF52606D' },
    };
    for (const n of [1, 2, 3]) hoja.mergeCells(n, 1, n, Math.max(columnas, 2));
    hoja.addRow([]);
  }

  private tabla(
    hoja: ExcelJS.Worksheet,
    columnas: ColumnaExportacion[],
    filas: Record<string, unknown>[],
    autofiltro: boolean,
  ): void {
    const cabecera = hoja.addRow(columnas.map((c) => c.titulo));
    cabecera.eachCell((celda) => {
      celda.font = { name: FUENTE, bold: true, color: { argb: 'FFFFFFFF' } };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: AZUL },
      };
      celda.alignment = { vertical: 'middle', wrapText: true };
    });
    const primera = cabecera.number;
    for (const f of filas) {
      const fila = hoja.addRow(
        columnas.map((c) => valorCelda(f[c.campo], c.tipo)),
      );
      fila.font = { name: FUENTE, size: 10 };
      columnas.forEach((c, i) => {
        const formato = c.tipo ? FORMATOS[c.tipo] : undefined;
        if (formato) fila.getCell(i + 1).numFmt = formato;
      });
    }
    if (autofiltro && filas.length) {
      hoja.autoFilter = {
        from: { row: primera, column: 1 },
        to: { row: primera + filas.length, column: columnas.length },
      };
    }
    columnas.forEach((c, i) => {
      const largo = Math.max(
        c.titulo.length,
        ...filas.slice(0, 500).map((f) => String(f[c.campo] ?? '').length),
      );
      hoja.getColumn(i + 1).width = Math.min(
        Math.max(largo + 2, c.tipo === 'fecha' ? 12 : 8),
        60,
      );
    });
  }

  /** Totales de una tabla bajo sus dos últimas columnas: etiqueta y valor. */
  private totales(hoja: ExcelJS.Worksheet, t: TablaImprimible): void {
    for (const total of t.totales ?? []) {
      const fila = hoja.addRow([]);
      fila.getCell(Math.max(t.columnas.length - 1, 1)).value = total.etiqueta;
      const celda = fila.getCell(t.columnas.length);
      celda.value = valorCelda(total.valor, total.tipo);
      celda.numFmt = (total.tipo && FORMATOS[total.tipo]) || 'General';
      fila.font = { name: FUENTE, bold: true };
    }
  }

  async listado(
    input: ExportarTablaInput,
    emisor: DatosEmisor,
    generado: string,
  ): Promise<Buffer> {
    const libro = this.libro();
    const hoja = libro.addWorksheet(
      input.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '),
    );
    this.encabezado(
      hoja,
      emisor,
      input.titulo,
      [input.subtitulo, `Generado: ${generado}`].filter(Boolean).join(' · '),
      input.columnas.length,
    );
    this.tabla(hoja, input.columnas, input.filas, true);
    if (input.totales) {
      const totales = input.totales;
      const fila = hoja.addRow(
        input.columnas.map((c, i) =>
          totales[c.campo] === undefined || totales[c.campo] === null
            ? i === 0
              ? 'Total'
              : null
            : valorCelda(totales[c.campo], c.tipo),
        ),
      );
      fila.font = { name: FUENTE, bold: true };
      input.columnas.forEach((c, i) => {
        const formato = c.tipo ? FORMATOS[c.tipo] : undefined;
        if (formato) fila.getCell(i + 1).numFmt = formato;
        fila.getCell(i + 1).border = {
          top: { style: 'medium', color: { argb: AZUL } },
        };
      });
    }
    hoja.views = [{ state: 'frozen', ySplit: 5 }];
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  async informe(
    informe: InformeImprimible,
    emisor: DatosEmisor,
    generado: string,
  ): Promise<Buffer> {
    const libro = this.libro();
    const hoja = libro.addWorksheet(informe.titulo.slice(0, 31));
    this.encabezado(
      hoja,
      emisor,
      informe.titulo,
      `Generado: ${generado}`,
      informe.columnas.length,
    );
    for (const d of informe.datos) {
      const fila = hoja.addRow([`${d.etiqueta}:`, valorCelda(d.valor, d.tipo)]);
      fila.getCell(1).font = { name: FUENTE, bold: true, size: 10 };
      fila.getCell(2).font = { name: FUENTE, size: 10 };
    }
    hoja.addRow([]);
    this.tabla(hoja, informe.columnas, informe.filas, false);
    this.totales(hoja, informe);
    hoja.getColumn(1).width = Math.max(hoja.getColumn(1).width ?? 0, 22);
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  async documento(
    doc: DocumentoImprimible,
    emisor: DatosEmisor,
    generado: string,
  ): Promise<Buffer> {
    const libro = this.libro();
    const hoja = libro.addWorksheet(doc.titulo.slice(0, 31));
    const anchoTablas = Math.max(
      4,
      ...doc.tablas.map((t) => t.columnas.length),
    );
    this.encabezado(
      hoja,
      emisor,
      `${doc.titulo} N° ${String(doc.numero).padStart(6, '0')}`,
      `Estado: ${doc.estado}${doc.anulado ? ` (motivo: ${doc.anulado.motivo ?? '-'})` : ''} · Generado: ${generado}`,
      anchoTablas,
    );
    for (const seccion of doc.secciones) {
      if (seccion.titulo) {
        hoja.addRow([seccion.titulo]).font = {
          name: FUENTE,
          bold: true,
          color: { argb: AZUL },
        };
      }
      for (const campo of seccion.campos) {
        const fila = hoja.addRow([
          campo.etiqueta,
          valorCelda(campo.valor, campo.tipo),
        ]);
        fila.getCell(1).font = { name: FUENTE, bold: true, size: 10 };
        fila.getCell(2).font = { name: FUENTE, size: 10 };
        const formato = campo.tipo ? FORMATOS[campo.tipo] : undefined;
        if (formato) fila.getCell(2).numFmt = formato;
        fila.getCell(2).alignment = { horizontal: 'left' };
      }
      hoja.addRow([]);
    }
    for (const t of doc.tablas) {
      if (t.titulo)
        hoja.addRow([t.titulo]).font = {
          name: FUENTE,
          bold: true,
          color: { argb: AZUL },
        };
      this.tabla(hoja, t.columnas, t.filas, false);
      this.totales(hoja, t);
      hoja.addRow([]);
    }
    if (doc.observaciones) {
      hoja.addRow(['Observaciones']).font = {
        name: FUENTE,
        bold: true,
        color: { argb: AZUL },
      };
      hoja.addRow([doc.observaciones]).font = { name: FUENTE, size: 10 };
    }
    hoja.getColumn(1).width = Math.max(hoja.getColumn(1).width ?? 0, 28);
    hoja.getColumn(2).width = Math.max(hoja.getColumn(2).width ?? 0, 36);
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}
