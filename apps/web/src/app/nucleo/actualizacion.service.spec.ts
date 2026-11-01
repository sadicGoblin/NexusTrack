import { fechaPublicacion } from './actualizacion.service';

describe('fechaPublicacion', () => {
  it('muestra la hora de Chile de una versión en UTC', () => {
    expect(fechaPublicacion('20261101185744')).toBe('01/11/2026 15:57');
    expect(fechaPublicacion('20260615120000')).toBe('15/06/2026 08:00');
  });

  it('queda vacía sin versión (desarrollo)', () => {
    expect(fechaPublicacion('')).toBe('');
  });
});
