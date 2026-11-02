import type { ExportarTablaInput } from '@nexustrack/shared';
import { alinearDerecha, escaparHtml as e, formatear } from './formato.js';
import type {
  DatosEmisor,
  DocumentoImprimible,
  InformeImprimible,
  TablaImprimible,
} from './tipos.js';

const ESTILOS = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1f2933; margin: 0; }
  .encabezado { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f4c81; padding-bottom: 10px; margin-bottom: 14px; }
  .emisor .nombre { font-size: 15px; font-weight: 700; color: #0f4c81; }
  .emisor .dato { color: #52606d; margin-top: 2px; }
  .titulo { text-align: right; }
  .titulo .doc { font-size: 15px; font-weight: 700; letter-spacing: .5px; }
  .titulo .numero { font-size: 20px; font-weight: 700; color: #0f4c81; margin-top: 2px; }
  .titulo .meta { color: #52606d; margin-top: 4px; }
  .estado { display: inline-block; padding: 2px 8px; border-radius: 10px; background: #e1effe; color: #0f4c81; font-weight: 600; font-size: 9px; }
  .estado.anulado { background: #fde8e8; color: #b42318; }
  .anulado-banda { border: 1px solid #f5c2c0; background: #fdf2f2; color: #b42318; padding: 6px 10px; margin-bottom: 12px; font-weight: 600; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #0f4c81; margin: 14px 0 6px; border-bottom: 1px solid #d9e2ec; padding-bottom: 3px; }
  .grilla { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; }
  .campo .etq { font-size: 8px; text-transform: uppercase; color: #7b8794; letter-spacing: .4px; }
  .campo .val { font-size: 10.5px; font-weight: 600; min-height: 13px; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #0f4c81; color: #fff; font-weight: 600; text-align: left; padding: 5px 6px; font-size: 9px; }
  td { padding: 4px 6px; border-bottom: 1px solid #e4e7eb; font-size: 9.5px; vertical-align: top; }
  tr:nth-child(even) td { background: #f5f7fa; }
  tfoot td { font-weight: 700; border-top: 1.5px solid #0f4c81; border-bottom: none; background: none !important; }
  .der { text-align: right; white-space: nowrap; }
  .totales { margin-top: 6px; margin-left: auto; width: 45%; }
  .totales td { border: none; padding: 3px 6px; background: none !important; }
  .totales tr:last-child td { font-weight: 700; font-size: 11px; border-top: 1.5px solid #0f4c81; }
  .obs { border: 1px solid #d9e2ec; padding: 8px; min-height: 30px; white-space: pre-wrap; }
  .firmas { display: flex; gap: 40px; margin-top: 50px; }
  .firma { flex: 1; border-top: 1px solid #52606d; text-align: center; padding-top: 4px; color: #52606d; }
  .resumen { color: #52606d; margin: -6px 0 10px; }
`;

function encabezado(
  emisor: DatosEmisor,
  titulo: string,
  numero: string | null,
  meta: string,
  estado?: string,
  anulado = false,
) {
  const datos = [
    emisor.rut && `RUT ${emisor.rut}`,
    emisor.direccion,
    emisor.telefono,
    emisor.email,
  ].filter(Boolean);
  return `
  <div class="encabezado">
    <div class="emisor">
      <div class="nombre">${e(emisor.nombre)}</div>
      ${datos.map((d) => `<div class="dato">${e(String(d))}</div>`).join('')}
    </div>
    <div class="titulo">
      <div class="doc">${e(titulo)}</div>
      ${numero ? `<div class="numero">N° ${e(numero)}</div>` : ''}
      <div class="meta">${e(meta)}</div>
      ${estado ? `<div style="margin-top:4px"><span class="estado ${anulado ? 'anulado' : ''}">${e(estado)}</span></div>` : ''}
    </div>
  </div>`;
}

/** Tabla con fila de totales opcional al pie (`pie`, por campo) y totales sueltos debajo. */
function tabla(t: TablaImprimible, pie?: Record<string, unknown>): string {
  const filas = t.filas
    .map(
      (f) =>
        `<tr>${t.columnas
          .map(
            (c) =>
              `<td class="${alinearDerecha(c.tipo) ? 'der' : ''}">${e(formatear(f[c.campo], c.tipo))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  const totales = t.totales?.length
    ? `<table class="totales">${t.totales
        .map(
          (x) =>
            `<tr><td>${e(x.etiqueta)}</td><td class="der">${e(formatear(x.valor, x.tipo))}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  return `
  ${t.titulo ? `<h2>${e(t.titulo)}</h2>` : ''}
  <table>
    <thead><tr>${t.columnas.map((c) => `<th class="${alinearDerecha(c.tipo) ? 'der' : ''}">${e(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${filas || `<tr><td colspan="${t.columnas.length}" style="text-align:center;color:#7b8794">Sin registros</td></tr>`}</tbody>
    ${
      pie
        ? `<tfoot><tr>${t.columnas
            .map((c, i) => {
              const v = pie[c.campo];
              const texto =
                v === undefined || v === null
                  ? i === 0
                    ? 'Total'
                    : ''
                  : formatear(v, c.tipo);
              return `<td class="${alinearDerecha(c.tipo) ? 'der' : ''}">${e(texto)}</td>`;
            })
            .join('')}</tr></tfoot>`
        : ''
    }
  </table>
  ${totales}`;
}

function pagina(cuerpo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>${cuerpo}</body></html>`;
}

export function htmlDocumento(
  doc: DocumentoImprimible,
  emisor: DatosEmisor,
  generado: string,
): string {
  const anulado = !!doc.anulado;
  const secciones = doc.secciones
    .map(
      (s) => `
    ${s.titulo ? `<h2>${e(s.titulo)}</h2>` : ''}
    <div class="grilla">
      ${s.campos
        .map(
          (c) => `<div class="campo" style="grid-column: span ${c.ancho ?? 1}">
            <div class="etq">${e(c.etiqueta)}</div><div class="val">${e(formatear(c.valor, c.tipo)) || '&nbsp;'}</div>
          </div>`,
        )
        .join('')}
    </div>`,
    )
    .join('');
  return pagina(`
    ${encabezado(emisor, doc.titulo, String(doc.numero).padStart(6, '0'), `Fecha: ${formatear(doc.fecha, 'fecha')} · Generado: ${generado}`, doc.estado, anulado)}
    ${anulado ? `<div class="anulado-banda">DOCUMENTO ANULADO${doc.anulado?.motivo ? ` · Motivo: ${e(doc.anulado.motivo)}` : ''}</div>` : ''}
    ${secciones}
    ${doc.tablas.map((t) => tabla(t)).join('')}
    ${doc.observaciones ? `<h2>Observaciones</h2><div class="obs">${e(doc.observaciones)}</div>` : ''}
    ${doc.firmas?.length ? `<div class="firmas">${doc.firmas.map((f) => `<div class="firma">${e(f)}</div>`).join('')}</div>` : ''}
  `);
}

export function htmlListado(
  input: ExportarTablaInput,
  emisor: DatosEmisor,
  generado: string,
): string {
  return pagina(`
    ${encabezado(emisor, input.titulo, null, `Generado: ${generado}`)}
    ${input.subtitulo ? `<div class="resumen">${e(input.subtitulo)}</div>` : ''}
    <div class="resumen">${input.filas.length} registro(s)</div>
    ${tabla({ columnas: input.columnas, filas: input.filas }, input.totales)}
  `);
}

export function htmlInforme(
  informe: InformeImprimible,
  emisor: DatosEmisor,
  generado: string,
): string {
  return pagina(`
    ${encabezado(emisor, informe.titulo, null, `Generado: ${generado}`)}
    <div class="grilla">
      ${informe.datos
        .map(
          (d) => `<div class="campo" style="grid-column: span 2">
            <div class="etq">${e(d.etiqueta)}</div><div class="val">${e(formatear(d.valor, d.tipo)) || '&nbsp;'}</div>
          </div>`,
        )
        .join('')}
    </div>
    ${tabla({ columnas: informe.columnas, filas: informe.filas, totales: informe.totales })}
  `);
}
