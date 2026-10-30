import { AuditoriaService } from './auditoria.service.js';

describe('AuditoriaService', () => {
  const servicio = new AuditoriaService();

  it('registra solo los campos que cambiaron, sin metadatos ni relaciones', () => {
    const antes = {
      id: 1,
      nombre: 'A',
      fono: null,
      actualizadoEn: new Date('2026-01-01'),
      empresa: { id: 2 },
    };
    const despues = {
      id: 1,
      nombre: 'B',
      fono: null,
      actualizadoEn: new Date('2026-02-01'),
      empresa: { id: 3 },
    };
    expect(servicio.diferencias(antes, despues)).toEqual({
      nombre: { antes: 'A', despues: 'B' },
    });
  });

  it('compara fechas por valor', () => {
    const d = (s: string) => ({ venc: new Date(s) });
    expect(servicio.diferencias(d('2026-10-20'), d('2026-10-20'))).toEqual({});
    expect(servicio.diferencias(d('2026-10-20'), d('2026-10-21'))).toEqual({
      venc: {
        antes: '2026-10-20T00:00:00.000Z',
        despues: '2026-10-21T00:00:00.000Z',
      },
    });
  });

  it('nunca guarda el hash de la contraseña en la instantánea', () => {
    expect(
      servicio.instantanea({
        id: 1,
        email: 'a@b.cl',
        passwordHash: 'x',
        versionToken: 0,
      }),
    ).toEqual({ id: 1, email: 'a@b.cl' });
  });
});
