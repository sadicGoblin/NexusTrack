import { formatearRutParcial } from './rut';

describe('formatearRutParcial', () => {
  it('agrega puntos y guion a medida que se escribe', () => {
    const pasos = ['1', '12', '123', '1234', '12345', '123456', '1234567', '12345678', '123456789'];
    expect(pasos.map(formatearRutParcial)).toEqual([
      '1',
      '1-2',
      '12-3',
      '123-4',
      '1.234-5',
      '12.345-6',
      '123.456-7',
      '1.234.567-8',
      '12.345.678-9',
    ]);
  });

  it('acepta K solo como dígito verificador y la deja en mayúscula', () => {
    expect(formatearRutParcial('7786207k')).toBe('7.786.207-K');
    expect(formatearRutParcial('77K862070')).toBe('7.786.207-0');
  });

  it('reformatea lo pegado con otro formato y corta lo que sobra', () => {
    expect(formatearRutParcial('77.862.070-7')).toBe('77.862.070-7');
    expect(formatearRutParcial(' 778620707 ')).toBe('77.862.070-7');
    expect(formatearRutParcial('7786207071')).toBe('77.862.070-7');
  });

  it('deja vacío lo que no tiene dígitos', () => {
    expect(formatearRutParcial('')).toBe('');
    expect(formatearRutParcial('-.')).toBe('');
  });
});
