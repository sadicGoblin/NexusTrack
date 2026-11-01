/**
 * Cuenta del conductor: lo que se le anticipa (vales de dinero) contra lo que rinde (total de la
 * rendición), flete a flete, como en las planillas de la empresa. Cada flete rendido deja un
 * resultado = anticipos − rendido, que se acumula en el saldo de la cuenta:
 *   positivo → a favor del conductor (le sobró anticipo; lo usa en el próximo flete);
 *   negativo → en contra del conductor (gastó más de lo anticipado; puso dinero propio).
 * El saldo se arrastra de un flete a otro: no hay devoluciones ni pagos aparte, se compensa con
 * los anticipos. Los fletes sin rendición no mueven el saldo: sus anticipos quedan «por rendir».
 */

type Fecha = string;

export interface ValeCuentaDto {
  id: number;
  numero: number;
  fecha: Fecha;
  monto: number;
}

export interface FleteCuentaDto {
  ordenRetiroId: number;
  ordenRetiroNumero: number;
  fechaRetiro: Fecha;
  cliente: string;
  origen: string;
  destino: string;
  vales: ValeCuentaDto[];
  anticipos: number;
  rendicionId: number | null;
  rendicionNumero: number | null;
  fechaRendicion: Fecha | null;
  /** Total de la rendición; null mientras el flete no se rinde. */
  rendido: number | null;
  /** Anticipos − rendido; null mientras el flete no se rinde. */
  resultado: number | null;
  /** Saldo de la cuenta después de este flete; null mientras no se rinde. */
  saldo: number | null;
}

export interface CuentaConductorDto {
  conductorId: number;
  conductor: string;
  rut: string;
  empresa: string;
  /** Suma de los resultados de los fletes rendidos. */
  saldo: number;
  /** Anticipos de fletes que aún no se rinden. */
  porRendir: number;
  fletesPorRendir: number;
  ultimoMovimiento: Fecha | null;
}

export interface DetalleCuentaDto extends CuentaConductorDto {
  /** Primero los fletes rendidos en orden cronológico y después los por rendir. */
  fletes: FleteCuentaDto[];
}

export type FleteSinCalcular = Omit<FleteCuentaDto, 'resultado' | 'saldo' | 'anticipos'>;

/** Ordena los fletes, calcula el resultado de cada uno y el saldo acumulado. */
export function armarCuenta(fletes: FleteSinCalcular[]): FleteCuentaDto[] {
  const rendidos = fletes
    .filter((f) => f.rendido !== null)
    .sort(
      (a, b) => a.fechaRendicion!.localeCompare(b.fechaRendicion!) || a.rendicionNumero! - b.rendicionNumero!,
    );
  const porRendir = fletes
    .filter((f) => f.rendido === null)
    .sort((a, b) => a.fechaRetiro.localeCompare(b.fechaRetiro) || a.ordenRetiroNumero - b.ordenRetiroNumero);
  let saldo = 0;
  return [
    ...rendidos.map((f) => {
      const anticipos = sumarVales(f.vales);
      const resultado = anticipos - f.rendido!;
      saldo += resultado;
      return { ...f, anticipos, resultado, saldo };
    }),
    ...porRendir.map((f) => ({
      ...f,
      anticipos: sumarVales(f.vales),
      resultado: null,
      saldo: null,
    })),
  ];
}

/** Totales de la cuenta a partir de los fletes ya armados. */
export function resumirCuenta(fletes: FleteCuentaDto[]) {
  const pendientes = fletes.filter((f) => f.rendido === null && f.anticipos > 0);
  const fechas = fletes.flatMap((f) => [f.fechaRendicion, ...f.vales.map((v) => v.fecha)]);
  return {
    saldo: fletes.reduce((s, f) => s + (f.resultado ?? 0), 0),
    porRendir: pendientes.reduce((s, f) => s + f.anticipos, 0),
    fletesPorRendir: pendientes.length,
    ultimoMovimiento:
      fechas
        .filter((f): f is string => !!f)
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Saldo de la cuenta antes del flete indicado: si ya se rindió, el que había justo antes de su
 * rendición; si no, el saldo actual (todavía no lo incluye).
 */
export function saldoAntesDe(fletes: FleteCuentaDto[], ordenRetiroId: number): number {
  let anterior = 0;
  for (const f of fletes) {
    if (f.resultado === null) break;
    if (f.ordenRetiroId === ordenRetiroId) return anterior;
    anterior = f.saldo!;
  }
  return anterior;
}

export type SentidoSaldo = 'a favor del conductor' | 'en contra del conductor' | 'sin saldo';

export function sentidoSaldo(saldo: number): SentidoSaldo {
  return saldo > 0 ? 'a favor del conductor' : saldo < 0 ? 'en contra del conductor' : 'sin saldo';
}

function sumarVales(vales: ValeCuentaDto[]): number {
  return vales.reduce((s, v) => s + v.monto, 0);
}
