import { enmascararFecha } from './campo-fecha';

describe('enmascararFecha', () => {
  it('agrega las barras al escribir solo números', () => {
    const pasos = ['2', '27', '271', '2710', '27102', '271020', '2710202', '27102026'];
    expect(pasos.map(enmascararFecha)).toEqual([
      '2',
      '27',
      '27/1',
      '27/10',
      '27/10/2',
      '27/10/20',
      '27/10/202',
      '27/10/2026',
    ]);
  });

  it('respeta las barras escritas y los días o meses de un dígito', () => {
    expect(enmascararFecha('27/')).toBe('27/');
    expect(enmascararFecha('1/5/2026')).toBe('1/5/2026');
    expect(enmascararFecha('27//')).toBe('27/');
  });

  it('corta el año en 4 dígitos y no toca textos con letras', () => {
    expect(enmascararFecha('271020261')).toBe('27/10/2026');
    expect(enmascararFecha('27/10/20261')).toBe('27/10/2026');
    expect(enmascararFecha('hoy')).toBe('hoy');
  });
});
