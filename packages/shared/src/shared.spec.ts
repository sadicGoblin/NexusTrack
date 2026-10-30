import { describe, expect, it } from 'vitest';
import {
  calcularCombustible,
  calcularDvRut,
  calcularRendicion,
  esFechaIso,
  esRutValido,
  formatearFecha,
  formatearPesos,
  formatearRut,
  generarTramo,
  hoyIso,
  limpiarRut,
  rangoMes,
  tienePermiso,
  totalNetoGuias,
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
    ).toEqual({ kmRecorridos: 374, totalViaticos: 14000, totalOtrosGastos: 5000, totalGeneral: 41000 });
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
  });
});
