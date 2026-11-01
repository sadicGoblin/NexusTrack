import { enmascararHora, normalizarHora } from './campo-hora';

describe('enmascararHora', () => {
  it('agrega los dos puntos al escribir solo números', () => {
    const pasos = ['1', '14', '143', '1430'];
    expect(pasos.map(enmascararHora)).toEqual(['1', '14', '14:3', '14:30']);
  });

  it('usa una sola cifra de hora cuando las dos no forman una hora válida', () => {
    expect(enmascararHora('930')).toBe('9:30');
    expect(enmascararHora('245')).toBe('2:45');
    expect(enmascararHora('0930')).toBe('09:30');
  });

  it('respeta los dos puntos escritos y corta en dos cifras', () => {
    expect(enmascararHora('9:')).toBe('9:');
    expect(enmascararHora('14:305')).toBe('14:30');
    expect(enmascararHora('ahora')).toBe('ahora');
  });
});

describe('normalizarHora', () => {
  it('completa con ceros a HH:mm', () => {
    expect(normalizarHora('9')).toBe('09:00');
    expect(normalizarHora('14')).toBe('14:00');
    expect(normalizarHora('9:5')).toBe('09:05');
    expect(normalizarHora('1430')).toBe('14:30');
    expect(normalizarHora('0:00')).toBe('00:00');
    expect(normalizarHora('23:59')).toBe('23:59');
  });

  it('rechaza horas fuera de rango o texto', () => {
    expect(normalizarHora('24:00')).toBeNull();
    expect(normalizarHora('12:60')).toBeNull();
    expect(normalizarHora('99')).toBeNull();
    expect(normalizarHora('hoy')).toBeNull();
  });
});
