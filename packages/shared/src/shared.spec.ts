import { describe, expect, it } from 'vitest';
import {
  calcularCombustible,
  calcularDvRut,
  calcularControlFlete,
  calcularRendicion,
  comisionFlete,
  esFechaIso,
  esRutValido,
  formatearFecha,
  formatearPesos,
  formatearRut,
  generarTramo,
  hoyIso,
  limpiarRut,
  armarCuenta,
  rangoMes,
  resumirCuenta,
  saldoAntesDe,
  sentidoSaldo,
  tienePermiso,
  type FleteSinCalcular,
  totalNetoGuias,
  totalesControlFletes,
} from './index.js';

describe('RUT', () => {
  it('valida los RUT reales de la planilla', () => {
    for (const rut of ['77.862.070-7', '96.999.710-K', '99.551.270-K', '9.809.727-9', '16.588.594-5']) {
      expect(esRutValido(rut), rut).toBe(true);
    }
  });
  it('detecta el RUT con dígito verificador erróneo que trae la planilla', () => {
    // TRANSPORTES B&B LIMITADA figura como 88.870.010-7; el dígito correcto para ese cuerpo es 2.
    expect(esRutValido('88.870.010-7')).toBe(false);
    expect(calcularDvRut('88870010')).toBe('2');
  });
  it('acepta espacios y minúsculas', () => {
    expect(esRutValido('76.995.184- 9')).toBe(true);
    expect(esRutValido('99551270k')).toBe(true);
  });
  it('rechaza dígito verificador incorrecto', () => {
    expect(esRutValido('77.862.070-8')).toBe(false);
    expect(esRutValido('abc')).toBe(false);
  });
  it('formatea y limpia', () => {
    expect(formatearRut('778620707')).toBe('77.862.070-7');
    expect(formatearRut('99551270k')).toBe('99.551.270-K');
    expect(limpiarRut(' 9.809.727-9 ')).toBe('98097279');
    expect(calcularDvRut('9809727')).toBe('9');
  });
});

describe('fechas', () => {
  it('valida fechas ISO reales', () => {
    expect(esFechaIso('2026-10-20')).toBe(true);
    expect(esFechaIso('2026-02-30')).toBe(false);
    expect(esFechaIso('20/10/2026')).toBe(false);
  });
  it('formatea a dd/mm/aaaa', () => {
    expect(formatearFecha('2026-10-20')).toBe('20/10/2026');
    expect(formatearFecha('2026-10-20T00:00:00.000Z')).toBe('20/10/2026');
    expect(formatearFecha(null)).toBe('');
  });
  it('calcula rango de mes y hoy en Chile', () => {
    expect(rangoMes(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    // 03:00 UTC del 21 es todavía el 20 en Chile (UTC-3).
    expect(hoyIso(new Date('2026-10-21T02:00:00Z'))).toBe('2026-10-20');
  });
});

describe('montos y cálculos', () => {
  it('formatea pesos chilenos', () => {
    expect(formatearPesos(565000)).toBe('$565.000');
    expect(formatearPesos(0)).toBe('$0');
  });
  it('genera el tramo como en la planilla', () => {
    expect(generarTramo('TALCA', 'VALPARAISO', 'CONTENEDOR')).toBe('TALCA - VALPARAISO - CONTENEDOR');
  });
  it('suma las guías del ejemplo de la planilla', () => {
    expect(
      totalNetoGuias([
        { cantidadTarifa: 1, valorUnitario: 565000 },
        { cantidadTarifa: 1, valorUnitario: 80000 },
      ]),
    ).toBe(645000);
  });
  it('calcula litros y total de combustible', () => {
    expect(
      calcularCombustible({
        numeralInicialCamion: 1000.5,
        numeralFinalCamion: 1200.75,
        numeralInicialRemolque: 50,
        numeralFinalRemolque: 80,
        valorLitro: 1000,
      }),
    ).toEqual({ litrosCamion: 200.25, litrosRemolque: 30, totalLitros: 230.25, total: 230250 });
  });
  it('ignora numerales incompletos o negativos', () => {
    expect(
      calcularCombustible({ numeralInicialCamion: 100, numeralFinalCamion: 50, valorLitro: 1000 })
        .totalLitros,
    ).toBe(0);
  });
  it('calcula totales de la rendición', () => {
    expect(
      calcularRendicion({
        odometroInicial: 1000,
        odometroFinal: 1374,
        peajes: 12000,
        carga: 5000,
        descarga: 5000,
        viaticos: [{ desayuno: 3000, almuerzo: 6000, comida: 5000 }],
        gastos: [{ monto: 4000 }, { monto: 1000 }],
      }),
    ).toEqual({
      kmRecorridos: 374,
      horasMotor: null,
      totalViaticos: 14000,
      totalOtrosGastos: 5000,
      totalGeneral: 41000,
    });
  });

  it('suma el petróleo al total y calcula las horas del motor del remolque', () => {
    const r = calcularRendicion({
      horometroInicial: 1520.5,
      horometroFinal: 1532.8,
      peajes: 10000,
      petroleo: 45000,
      viaticos: [],
      gastos: [],
    });
    expect(r).toMatchObject({ horasMotor: 12.3, totalGeneral: 55000 });
    expect(
      calcularRendicion({ horometroInicial: 10, horometroFinal: 5, viaticos: [], gastos: [] }).horasMotor,
    ).toBeNull();
  });
});

describe('permisos', () => {
  it('aplica la matriz por rol', () => {
    expect(tienePermiso('ADMIN', 'anular')).toBe(true);
    expect(tienePermiso('OPERACIONES', 'anular')).toBe(false);
    expect(tienePermiso('FINANZAS', 'editarFinanzas')).toBe(true);
    expect(tienePermiso('FINANZAS', 'editarOperacion')).toBe(false);
    expect(tienePermiso('LECTURA', 'ver')).toBe(true);
    expect(tienePermiso(null, 'ver')).toBe(false);
    expect(tienePermiso('ADMIN', 'eliminar')).toBe(true);
    expect(tienePermiso('OPERACIONES', 'eliminar')).toBe(false);
    expect(tienePermiso('FINANZAS', 'editarCerrados')).toBe(false);
  });
});

describe('cuenta del conductor', () => {
  const flete = (
    n: number,
    anticipos: number[],
    rendicion?: { numero: number; fecha: string; total: number },
  ): FleteSinCalcular => ({
    clave: `R${n}`,
    tipo: 'FLETE',
    ordenRetiroId: n,
    ordenRetiroNumero: n,
    fecha: `2026-10-0${n}`,
    cliente: 'COEXCA',
    origen: 'LOS ANDES',
    destino: 'SAN ANTONIO',
    vales: anticipos.map((monto, i) => ({
      id: n * 10 + i,
      numero: n * 10 + i,
      fecha: `2026-10-0${n}`,
      monto,
    })),
    rendicionId: rendicion?.numero ?? null,
    rendicionNumero: rendicion?.numero ?? null,
    fechaRendicion: rendicion?.fecha ?? null,
    rendido: rendicion?.total ?? null,
  });

  // Flete 1: anticipo 100.000, gastó 120.000 → −20.000 (en contra: puso plata propia).
  // Flete 2: anticipos 50.000 + 30.000, gastó 70.000 → +10.000; saldo −10.000.
  // Flete 3: anticipo 60.000 sin rendir.
  const fletes = armarCuenta([
    flete(3, [60000]),
    flete(2, [50000, 30000], { numero: 8, fecha: '2026-10-09', total: 70000 }),
    flete(1, [100000], { numero: 5, fecha: '2026-10-04', total: 120000 }),
  ]);

  it('ordena los rendidos por fecha de rendición y acumula el saldo', () => {
    expect(fletes.map((f) => [f.ordenRetiroNumero, f.anticipos, f.resultado, f.saldo])).toEqual([
      [1, 100000, -20000, -20000],
      [2, 80000, 10000, -10000],
      [3, 60000, null, null],
    ]);
  });

  it('resume saldo y anticipos por rendir', () => {
    expect(resumirCuenta(fletes)).toEqual({
      saldo: -10000,
      porRendir: 60000,
      fletesPorRendir: 1,
      ultimoMovimiento: '2026-10-09',
    });
  });

  it('da el saldo previo a cada flete', () => {
    expect(saldoAntesDe(fletes, 'R1')).toBe(0);
    expect(saldoAntesDe(fletes, 'R2')).toBe(-20000);
    // Un flete sin rendir ve el saldo actual.
    expect(saldoAntesDe(fletes, 'R3')).toBe(-10000);
  });

  it('suma las estadías como un flete más, por fecha de rendición', () => {
    const estadia: FleteSinCalcular = {
      ...flete(4, [20000], { numero: 6, fecha: '2026-10-05', total: 15000 }),
      clave: 'E4',
      tipo: 'ESTADIA',
      ordenRetiroId: null,
      ordenRetiroNumero: null,
      cliente: null,
    };
    const cuenta = armarCuenta([...fletes, estadia]);
    expect(cuenta.map((f) => [f.clave, f.saldo])).toEqual([
      ['R1', -20000],
      ['E4', -15000],
      ['R2', -5000],
      ['R3', null],
    ]);
  });

  it('describe el sentido del saldo', () => {
    expect(sentidoSaldo(10000)).toBe('a favor del conductor');
    expect(sentidoSaldo(-1)).toBe('en contra del conductor');
    expect(sentidoSaldo(0)).toBe('sin saldo');
  });
});

describe('control de fletes', () => {
  const datos = {
    distancia: 500,
    litrosCamion: 200,
    litrosRemolque: 30,
    horometro: 12,
    anticipo: 150000,
    peajes: 20000,
    viatico: 14000,
    cargaDescarga: 10000,
    petroleo: 45000,
    otrosGastos: 5000,
    combustible: 230000,
    comisiones: 45200,
    valorFlete: 565000,
  };

  it('aplica las fórmulas de la planilla del cliente', () => {
    expect(calcularControlFlete(datos)).toEqual({
      kmPorLitro: 2.5,
      litrosPorHora: 2.5,
      totalGastos: 94000,
      saldo: 56000,
      costoTotal: 369200,
      margen: 195800,
      rentabilidad: 0.3465,
    });
  });

  it('deja vacíos los rendimientos sin datos y la rentabilidad sin valor del flete', () => {
    expect(calcularControlFlete({ ...datos, distancia: null, horometro: 0, valorFlete: 0 })).toMatchObject({
      kmPorLitro: null,
      litrosPorHora: null,
      rentabilidad: null,
    });
  });

  it('calcula la comisión con el % del conductor', () => {
    expect(comisionFlete(565000, 0.08)).toBe(45200);
    expect(comisionFlete(565000, null)).toBe(0);
  });

  it('totaliza con rendimientos y rentabilidad del conjunto', () => {
    const fila = (d: typeof datos) => ({ ...d, ...calcularControlFlete(d) });
    const t = totalesControlFletes([
      fila(datos),
      fila({ ...datos, distancia: null, litrosCamion: 100, valorFlete: 435000 }),
    ]);
    expect(t).toMatchObject({
      distancia: 500,
      litrosCamion: 300,
      kmPorLitro: 2.5,
      litrosPorHora: 2.5,
      valorFlete: 1000000,
      margen: 261600,
      rentabilidad: 0.2616,
    });
  });
});
