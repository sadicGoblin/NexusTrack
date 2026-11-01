import { detalleDe, etiquetaCampo, valorLegible } from './auditoria';

describe('auditoría legible', () => {
  it('nombra los campos en español', () => {
    expect(etiquetaCampo('fechaCarga')).toBe('Fecha carga');
    expect(etiquetaCampo('vencSeguro')).toBe('Vencimiento seguro');
    expect(etiquetaCampo('tramoId')).toBe('Tramo (id)');
    expect(etiquetaCampo('numero')).toBe('N°');
  });

  it('muestra valores como en la pantalla', () => {
    expect(valorLegible('fechaCarga', '2026-10-30T00:00:00.000Z')).toBe('30/10/2026');
    expect(valorLegible('estado', 'RENDIDA')).toBe('Rendida');
    expect(valorLegible('activo', false)).toBe('No');
    expect(valorLegible('numero', 12)).toBe('000012');
    expect(valorLegible('monto', 150000)).toBe('$150.000');
    expect(valorLegible('kmRecorridos', 1374)).toBe('1.374');
    expect(valorLegible('observaciones', null)).toBe('—');
  });

  it('separa una edición campo a campo', () => {
    const d = detalleDe({ horaCarga: { antes: '08:00', despues: '09:30' } });
    expect(d.modo).toBe('cambios');
    expect(d.filas).toEqual([{ campo: 'Hora carga', antes: '08:00', despues: '09:30' }]);
  });

  it('muestra la copia de un registro eliminado con sus líneas', () => {
    const d = detalleDe({
      estado: 'ABIERTA',
      ordenRetiroId: 7,
      observaciones: null,
      numero: 2,
      guias: [{ id: 1, linea: 1, numeroGuia: '123', tramoId: 4, total: 50000 }],
    });
    expect(d.modo).toBe('copia');
    expect(d.filas).toEqual([
      { campo: 'N°', valor: '000002' },
      { campo: 'Estado', valor: 'Abierta' },
    ]);
    expect(d.lineas[0].columnas).toEqual(['Línea', 'N° guía', 'Total']);
    expect(d.lineas[0].filas).toEqual([['1', '123', '$50.000']]);
  });
});
