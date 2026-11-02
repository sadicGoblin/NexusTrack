import { lineasFacturacion } from './informes.js';

const guia = (numeroGuia: string, extra: Record<string, unknown> = {}) => ({
  numeroGuia,
  fechaGuia: new Date('2026-11-10T00:00:00Z'),
  especie: { valor: 'CONTENEDOR' },
  umEspecie: { valor: 'PALLETS' },
  cantidadEspecie: 20,
  numeroContenedor: 'BUN38483483',
  tramoTexto: 'TALCA - VALPARAISO - CONTENEDOR',
  umTarifa: { valor: 'VIAJE' },
  cantidadTarifa: 1,
  valorUnitario: 565000,
  total: 565000,
  ...extra,
});

describe('órdenes por facturar', () => {
  it('agrupa las guías de una orden por tarifa y separa sus números con guion', () => {
    const lineas = lineasFacturacion({
      id: 7,
      numero: 83157,
      fechaCarga: new Date('2026-11-10T00:00:00Z'),
      ordenRetiro: {
        cliente: { id: 1, nombre: 'COEXCA S.A.', rut: '96.999.710-K' },
      },
      guias: [
        guia('158232'),
        guia('158233', { cantidadEspecie: null }),
        guia('158234', {
          tramoTexto: 'TALCA - SANTIAGO - THERMO',
          valorUnitario: 500000,
          total: 500000,
          numeroContenedor: null,
        }),
      ],
    });
    expect(lineas).toEqual([
      expect.objectContaining({
        ordenCarga: 83157,
        fechaOrdenCarga: '2026-11-10',
        guias: '158232 - 158233',
        cantidadEspecie: 20,
        contenedor: 'BUN38483483',
        cantidadTarifa: 2,
        valorUnitario: 565000,
        total: 1130000,
      }),
      expect.objectContaining({
        guias: '158234',
        tramo: 'TALCA - SANTIAGO - THERMO',
        contenedor: null,
        total: 500000,
      }),
    ]);
  });
});
