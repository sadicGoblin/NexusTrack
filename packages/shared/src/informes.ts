/**
 * Informes de solo lectura: control de fletes (costos y margen de cada flete) y órdenes de carga
 * por facturar. Se calculan al vuelo desde los documentos emitidos.
 */
import type { EstadoOrdenCarga, TipoRendicion } from './enums.js';
import { redondear } from './montos.js';

type Fecha = string;

export interface FiltroInforme {
  desde?: Fecha;
  hasta?: Fecha;
  clienteId?: number;
}

// ───────────────────────────── Control de fletes ─────────────────────────────

/** Datos de un flete que salen de los documentos (columnas «BD» de la planilla del cliente). */
export interface DatosControlFlete {
  /** Kilómetros recorridos según los odómetros de la rendición. */
  distancia: number | null;
  /** Litros de los vales de combustible emitidos. */
  litrosCamion: number;
  litrosRemolque: number;
  /** Horas del motor del remolque según los horómetros de la rendición. */
  horometro: number | null;
  /** Vales de dinero emitidos. */
  anticipo: number;
  peajes: number;
  viatico: number;
  cargaDescarga: number;
  /** Petróleo pagado en ruta: es parte del total de la rendición. */
  petroleo: number;
  otrosGastos: number;
  /** Total de los vales de combustible emitidos. */
  combustible: number;
  comisiones: number;
  /** Total neto de la orden de carga. */
  valorFlete: number;
}

/** Columnas «Cálculo» de la planilla. */
export interface CalculosControlFlete {
  /** Distancia / litros camión. */
  kmPorLitro: number | null;
  /** Litros remolque / horómetro. */
  litrosPorHora: number | null;
  /** Peajes + viático + carga-descarga + petróleo + otros gastos (= total de la rendición). */
  totalGastos: number;
  /** Anticipo − total gastos: positivo a favor del conductor, como en su cuenta. */
  saldo: number;
  /** Total gastos + combustible + comisiones. */
  costoTotal: number;
  /** Valor flete − costo total. */
  margen: number;
  /** Margen / valor flete. */
  rentabilidad: number | null;
}

export interface FilaControlFleteDto extends DatosControlFlete, CalculosControlFlete {
  /** «C<id de la orden de carga>» o «E<id de la estadía>». */
  id: string;
  /** Una estadía no tiene cliente ni valor de flete: solo costos. */
  tipo: TipoRendicion;
  ordenCargaId: number | null;
  ordenRetiroId: number | null;
  rendicionId: number | null;
  /** Abierta (por rendir) o rendida; una estadía es su propia rendición. */
  estado: EstadoOrdenCarga;
  conductor: string;
  /** Fecha de la orden de retiro o de inicio de la estadía. */
  fecha: Fecha;
  ordenRetiro: number | null;
  ordenCarga: number | null;
  rendicion: number | null;
  /** Salida y llegada anotadas en la rendición. */
  fechaInicio: Fecha | null;
  fechaTermino: Fecha | null;
  clienteId: number | null;
  cliente: string | null;
  /** Tramo del flete o «ESTADÍA - <lugar>». */
  tramo: string | null;
  /** Números de los vales de dinero, separados por coma. */
  numerosAnticipo: string;
}

const dividir = (a: number | null, b: number | null, decimales: number): number | null =>
  a !== null && b ? redondear(a / b, decimales) : null;

/** Comisión del conductor sobre el valor del flete (% de comisión como fracción). */
export function comisionFlete(valorFlete: number, comision: number | null | undefined): number {
  return Math.round(valorFlete * (comision ?? 0));
}

export function calcularControlFlete(d: DatosControlFlete): CalculosControlFlete {
  const totalGastos = d.peajes + d.viatico + d.cargaDescarga + d.petroleo + d.otrosGastos;
  const costoTotal = totalGastos + d.combustible + d.comisiones;
  const margen = d.valorFlete - costoTotal;
  return {
    kmPorLitro: dividir(d.distancia, d.litrosCamion, 2),
    litrosPorHora: dividir(d.litrosRemolque, d.horometro, 2),
    totalGastos,
    saldo: d.anticipo - totalGastos,
    costoTotal,
    margen,
    rentabilidad: dividir(margen, d.valorFlete, 4),
  };
}

const SUMABLES = [
  'litrosCamion',
  'litrosRemolque',
  'anticipo',
  'peajes',
  'viatico',
  'cargaDescarga',
  'petroleo',
  'otrosGastos',
  'totalGastos',
  'saldo',
  'combustible',
  'comisiones',
  'costoTotal',
  'valorFlete',
  'margen',
] as const;

export type TotalesControlFletes = Record<(typeof SUMABLES)[number] | 'distancia' | 'horometro', number> &
  Record<'kmPorLitro' | 'litrosPorHora' | 'rentabilidad', number | null>;

/**
 * Fila de totales: sumas, y los rendimientos y la rentabilidad del conjunto (no el promedio de
 * cada fila). Los rendimientos solo consideran los fletes que tienen ambos datos.
 */
export function totalesControlFletes(
  filas: Pick<FilaControlFleteDto, (typeof SUMABLES)[number] | 'distancia' | 'horometro'>[],
): TotalesControlFletes {
  const totales = {} as Record<(typeof SUMABLES)[number], number>;
  for (const campo of SUMABLES) totales[campo] = filas.reduce((s, f) => s + f[campo], 0);
  for (const campo of ['litrosCamion', 'litrosRemolque'] as const)
    totales[campo] = redondear(totales[campo], 2);
  const conKm = filas.filter((f) => f.distancia !== null && f.litrosCamion > 0);
  const conHoras = filas.filter((f) => f.horometro && f.litrosRemolque > 0);
  const distancia = filas.reduce((s, f) => s + (f.distancia ?? 0), 0);
  const horometro = filas.reduce((s, f) => s + (f.horometro ?? 0), 0);
  return {
    ...totales,
    distancia,
    horometro: redondear(horometro, 1),
    kmPorLitro: dividir(
      conKm.reduce((s, f) => s + f.distancia!, 0),
      conKm.reduce((s, f) => s + f.litrosCamion, 0),
      2,
    ),
    litrosPorHora: dividir(
      conHoras.reduce((s, f) => s + f.litrosRemolque, 0),
      conHoras.reduce((s, f) => s + f.horometro!, 0),
      2,
    ),
    rentabilidad: dividir(totales.margen, totales.valorFlete, 4),
  };
}

// ───────────────────────────── Órdenes por facturar ─────────────────────────────

/** Una línea del informe: las guías de una orden de carga con la misma tarifa. */
export interface LineaFacturacionDto {
  ordenCargaId: number;
  ordenCarga: number;
  fechaOrdenCarga: Fecha;
  /** Números de guía distintos, separados por guion. */
  guias: string;
  fechaGuia: Fecha;
  especie: string | null;
  umEspecie: string | null;
  cantidadEspecie: number | null;
  contenedor: string | null;
  tramo: string;
  umTarifa: string | null;
  cantidadTarifa: number;
  valorUnitario: number;
  total: number;
}

/** Totales por cliente en el período. */
export interface ResumenFacturacionDto {
  clienteId: number;
  cliente: string;
  rut: string;
  ordenes: number;
  guias: number;
  total: number;
}

export interface InformeFacturacionDto {
  clienteId: number;
  cliente: string;
  rut: string;
  desde: Fecha | null;
  hasta: Fecha | null;
  lineas: LineaFacturacionDto[];
  total: number;
}
