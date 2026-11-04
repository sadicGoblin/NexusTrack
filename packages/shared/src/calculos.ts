/**
 * Cálculos de negocio. La API los aplica como fuente de verdad al guardar; la web
 * los usa para mostrar los totales en vivo mientras se completa un formulario.
 */
import { redondear } from './montos.js';

/** Texto del tramo de una ruta tarifa: "ORIGEN - DESTINO - UNIDAD". */
export function generarTramo(origen: string, destino: string, unidad: string): string {
  return [origen, destino, unidad].map((s) => s.trim()).join(' - ');
}

/**
 * Código de packing o ruta tarifa: letras, guion y número de al menos 3 dígitos, como los que
 * asigna el sistema (COX005, cox 5 o COX_005 → COX-005). Otra forma queda tal cual, en mayúsculas.
 */
export function formatearCodigo(codigo: string): string {
  const t = codigo.trim().toUpperCase();
  const m = /^([A-Z]+)[\s_.-]*(\d+)$/.exec(t);
  return m ? `${m[1]}-${m[2]!.padStart(3, '0')}` : t;
}

/** Total de una línea de guía: cantidad × valor unitario, en pesos enteros. */
export function totalLineaGuia(cantidadTarifa: number, valorUnitario: number): number {
  return Math.round((cantidadTarifa || 0) * (valorUnitario || 0));
}

/** Total neto de una orden de carga: suma de los totales de sus guías. */
export function totalNetoGuias(lineas: { cantidadTarifa: number; valorUnitario: number }[]): number {
  return lineas.reduce((suma, l) => suma + totalLineaGuia(l.cantidadTarifa, l.valorUnitario), 0);
}

/** Litros despachados según numerales de bomba. Devuelve null si falta un numeral o es negativo. */
export function litrosPorNumerales(
  inicial: number | null | undefined,
  final: number | null | undefined,
): number | null {
  if (inicial === null || inicial === undefined || final === null || final === undefined) return null;
  const litros = redondear(final - inicial, 2);
  return litros < 0 ? null : litros;
}

export interface EntradaCombustible {
  numeralInicialCamion?: number | null;
  numeralFinalCamion?: number | null;
  numeralInicialRemolque?: number | null;
  numeralFinalRemolque?: number | null;
  valorLitro: number;
}

export interface ResultadoCombustible {
  litrosCamion: number;
  litrosRemolque: number;
  totalLitros: number;
  total: number;
}

export function calcularCombustible(e: EntradaCombustible): ResultadoCombustible {
  const litrosCamion = litrosPorNumerales(e.numeralInicialCamion, e.numeralFinalCamion) ?? 0;
  const litrosRemolque = litrosPorNumerales(e.numeralInicialRemolque, e.numeralFinalRemolque) ?? 0;
  const totalLitros = redondear(litrosCamion + litrosRemolque, 2);
  return { litrosCamion, litrosRemolque, totalLitros, total: Math.round(totalLitros * (e.valorLitro || 0)) };
}

export interface EntradaViatico {
  desayuno?: number | null;
  almuerzo?: number | null;
  comida?: number | null;
}

export function totalViatico(v: EntradaViatico): number {
  return (v.desayuno || 0) + (v.almuerzo || 0) + (v.comida || 0);
}

export interface EntradaRendicion {
  odometroInicial?: number | null;
  odometroFinal?: number | null;
  horometroInicial?: number | null;
  horometroFinal?: number | null;
  peajes?: number | null;
  carga?: number | null;
  descarga?: number | null;
  petroleo?: number | null;
  viaticos: EntradaViatico[];
  gastos: { monto?: number | null }[];
}

export interface ResultadoRendicion {
  kmRecorridos: number | null;
  /** Horas del motor del remolque: horómetro final − inicial. */
  horasMotor: number | null;
  totalViaticos: number;
  totalOtrosGastos: number;
  totalGeneral: number;
}

/** Final − inicial si ambos existen y el final no es menor. */
function diferencia(inicial?: number | null, final?: number | null): number | null {
  if (inicial === null || inicial === undefined || final === null || final === undefined) return null;
  return final >= inicial ? final - inicial : null;
}

export function calcularRendicion(e: EntradaRendicion): ResultadoRendicion {
  const km = diferencia(e.odometroInicial, e.odometroFinal);
  const horas = diferencia(e.horometroInicial, e.horometroFinal);
  const totalViaticos = e.viaticos.reduce((s, v) => s + totalViatico(v), 0);
  const totalOtrosGastos = e.gastos.reduce((s, g) => s + (g.monto || 0), 0);
  const totalGeneral =
    (e.peajes || 0) +
    (e.carga || 0) +
    (e.descarga || 0) +
    (e.petroleo || 0) +
    totalViaticos +
    totalOtrosGastos;
  return {
    kmRecorridos: km,
    horasMotor: horas === null ? null : redondear(horas, 1),
    totalViaticos,
    totalOtrosGastos,
    totalGeneral,
  };
}
