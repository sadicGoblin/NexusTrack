import { dateAIso, isoADate } from './fechas';

describe('conversión de fechas', () => {
  it('convierte ISO a fecha local sin corrimiento por zona horaria', () => {
    const d = isoADate('2026-10-20')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 20]);
  });

  it('ida y vuelta conserva el día', () => {
    expect(dateAIso(isoADate('2026-02-28'))).toBe('2026-02-28');
    expect(dateAIso(isoADate('2026-10-20T00:00:00.000Z'))).toBe('2026-10-20');
  });

  it('acepta vacíos', () => {
    expect(isoADate(null)).toBeNull();
    expect(dateAIso(null)).toBeNull();
  });
});
