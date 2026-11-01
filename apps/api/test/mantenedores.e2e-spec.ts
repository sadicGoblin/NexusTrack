import type { INestApplication } from '@nestjs/common';
import {
  catalogos,
  crearApp,
  iniciarSesion,
  type Cliente,
} from './utilidades.js';

describe('Datos iniciales y mantenedores', () => {
  let app: INestApplication;
  let c: Cliente;
  let id: Awaited<ReturnType<typeof catalogos>>;

  beforeAll(async () => {
    app = await crearApp();
    c = (await iniciarSesion(app, 'admin@nexustrack.cl', 'Admin123!')).cliente;
    id = await catalogos(c);
  });
  afterAll(() => app.close());

  it('carga los datos de la planilla', async () => {
    expect((await c.get('/catalogos').expect(200)).body).toHaveLength(126);
    expect((await c.get('/empresas').expect(200)).body).toHaveLength(10);
    expect((await c.get('/clientes').expect(200)).body).toHaveLength(2);
    expect((await c.get('/moviles').expect(200)).body).toHaveLength(5);
    expect((await c.get('/conductores').expect(200)).body).toHaveLength(4);
    const rutas = (await c.get('/rutas-tarifas').expect(200)).body;
    expect(rutas.map((r: { codigo: string }) => r.codigo).sort()).toEqual([
      'RT-001',
      'RT-002',
      'RT-003',
      'RT-004',
    ]);
    // PLATADORMA corregido al importar
    expect(() => id('UNIDAD_RUTA', 'PLATAFORMA')).not.toThrow();
  });

  it('deriva el tipo de empresa del móvil desde la categoría', async () => {
    const moviles = (await c.get('/moviles').expect(200)).body;
    expect(
      moviles.find((m: { patente: string }) => m.patente === 'DRXR59'),
    ).toMatchObject({ tipo: 'CAMION', tipoEmpresa: 'SOCIO', anio: 2012 });
  });

  it('valida el RUT solo cuando es nuevo o cambia', async () => {
    const empresas = (await c.get('/empresas').expect(200)).body;
    const bb = empresas.find(
      (e: { razonSocial: string }) =>
        e.razonSocial === 'TRANSPORTES B&B LIMITADA',
    );
    expect(bb.rut).toBe('88.870.010-7');
    await c
      .put(`/empresas/${bb.id}`, { ...bb, fono: '+56 9 1111 2222' })
      .expect(200);
    const r = await c.put(`/empresas/${bb.id}`, { ...bb, rut: '88.870.010-8' });
    expect(r.status).toBe(400);
    await c.put(`/empresas/${bb.id}`, { ...bb, rut: '88870010-2' }).expect(200);
  });

  it('crea una empresa normalizando datos y rechaza duplicados', async () => {
    const nueva = {
      rut: '76.086.428-5',
      razonSocial: '  transportes  prueba spa ',
      categoriaId: id('CATEGORIA_EMPRESA', 'EXTERNO'),
      email: 'Contacto@Prueba.CL',
    };
    const e = (await c.post('/empresas', nueva).expect(201)).body;
    expect(e).toMatchObject({
      rut: '76.086.428-5',
      razonSocial: 'TRANSPORTES PRUEBA SPA',
      email: 'contacto@prueba.cl',
      categoria: 'EXTERNO',
    });
    const dup = await c.post('/empresas', { ...nueva, rut: '760864285' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/RUT/);
    const tipoErrado = await c.post('/empresas', {
      ...nueva,
      rut: '11.111.111-1',
      categoriaId: id('CIUDAD', 'TALCA'),
    });
    expect(tipoErrado.status).toBe(400);
  });

  it('normaliza patentes y valida el tipo de móvil', async () => {
    const empresa = (await c.get('/empresas').expect(200)).body[0];
    const m = (
      await c
        .post('/moviles', {
          patente: 'ab-cd 12',
          tipoId: id('TIPO_MOVIL', 'THERMO'),
          empresaId: empresa.id,
          vencSeguro: '2026-11-15',
          color: 'blanco',
          numeroMotor: '35257279',
          numeroChasis: '1fujawa80alas0141',
        })
        .expect(201)
    ).body;
    expect(m).toMatchObject({
      patente: 'ABCD12',
      tipoCodigo: 'THERMO',
      vencSeguro: '2026-11-15',
      color: 'BLANCO',
      numeroMotor: '35257279',
      numeroChasis: '1FUJAWA80ALAS0141',
    });
    await c
      .post('/moviles', {
        patente: 'ABCD12',
        tipoId: id('TIPO_MOVIL', 'THERMO'),
        empresaId: empresa.id,
      })
      .expect(409);
    await c
      .post('/moviles', {
        patente: 'ZZ9999',
        tipoId: id('TIPO_MOVIL', 'THERMO'),
        empresaId: empresa.id,
        vencSeguro: '2026-02-30',
      })
      .expect(400);
  });

  it('genera códigos y tramo en packings y rutas tarifas', async () => {
    const cliente = (await c.get('/clientes').expect(200)).body[0];
    const p = (
      await c
        .post('/packings', { nombre: 'planta norte', clienteId: cliente.id })
        .expect(201)
    ).body;
    expect(p.codigo).toBe('PK-003');
    const r = (
      await c
        .post('/rutas-tarifas', {
          clienteId: cliente.id,
          origenId: id('CIUDAD', 'CURICO'),
          destinoId: id('CIUDAD', 'SAN ANTONIO'),
          unidadId: id('UNIDAD_RUTA', 'BINS'),
          valor: 250000,
          distanciaKm: 260.5,
          vigenciaDesde: '2026-01-01',
          vigenciaHasta: '2026-12-31',
        })
        .expect(201)
    ).body;
    expect(r).toMatchObject({
      codigo: 'RT-005',
      tramo: 'CURICO - SAN ANTONIO - BINS',
      vigente: true,
    });
    await c
      .post('/rutas-tarifas', {
        clienteId: cliente.id,
        origenId: id('CIUDAD', 'CURICO'),
        destinoId: id('CIUDAD', 'TALCA'),
        unidadId: id('UNIDAD_RUTA', 'BINS'),
        valor: 1,
        vigenciaDesde: '2026-12-31',
        vigenciaHasta: '2026-01-01',
      })
      .expect(400);
    const vigentes = (
      await c
        .get(`/rutas-tarifas?clienteId=${cliente.id}&vigentesAl=2026-06-01`)
        .expect(200)
    ).body;
    expect(vigentes.map((x: { tramo: string }) => x.tramo)).toEqual([
      'CURICO - SAN ANTONIO - BINS',
    ]);
  });

  it('no permite crear valores en catálogos de sistema, sí en los editables', async () => {
    await c
      .post('/catalogos', { tipo: 'TIPO_MOVIL', valor: 'BUS' })
      .expect(400);
    const nuevo = (
      await c
        .post('/catalogos', { tipo: 'CIUDAD', valor: 'quillota' })
        .expect(201)
    ).body;
    expect(nuevo).toMatchObject({ valor: 'QUILLOTA', orden: 59 });
    await c
      .post('/catalogos', { tipo: 'CIUDAD', valor: 'QUILLOTA' })
      .expect(409);
  });

  it('gestiona asignaciones con historial, conflictos y sugerencias', async () => {
    const camiones = (await c.get('/moviles?grupo=camion').expect(200)).body;
    const remolques = (await c.get('/moviles?grupo=remolque').expect(200)).body;
    const conductores = (await c.get('/conductores').expect(200)).body;
    const rhgc58 = camiones.find(
      (m: { patente: string }) => m.patente === 'RHGC58',
    );
    const drxr59 = camiones.find(
      (m: { patente: string }) => m.patente === 'DRXR59',
    );
    const chasis = remolques.find(
      (m: { patente: string }) => m.patente === 'JK5362',
    );
    const thermo = remolques.find(
      (m: { patente: string }) => m.patente === 'JB8369',
    );
    const luis = conductores.find((x: { nombre: string }) =>
      x.nombre.startsWith('LUIS ENRIQUE'),
    );

    const tablero = (await c.get('/asignaciones/tablero').expect(200)).body;
    expect(
      tablero.find((t: { camion: string }) => t.camion === 'RHGC58').asignacion,
    ).toMatchObject({ chasis: 'JK5362', conductor: null });

    const a1 = (
      await c
        .post('/asignaciones', {
          camionId: rhgc58.id,
          conductorId: luis.id,
          chasisId: chasis.id,
          fechaAsignacion: '2026-10-21',
        })
        .expect(201)
    ).body;
    expect(a1).toMatchObject({
      conductor: luis.nombre,
      chasis: 'JK5362',
      vigente: true,
    });

    // El conductor no puede estar en dos camiones a la vez.
    const choque = await c.post('/asignaciones', {
      camionId: drxr59.id,
      conductorId: luis.id,
      fechaAsignacion: '2026-10-21',
    });
    expect(choque.status).toBe(409);
    expect(choque.body.message).toMatch(/RHGC58/);

    // Cambio rápido de chasis por thermo: cierra la vigente y crea una nueva.
    const a2 = (
      await c
        .post('/asignaciones', {
          camionId: rhgc58.id,
          conductorId: luis.id,
          thermoId: thermo.id,
          fechaAsignacion: '2026-10-25',
        })
        .expect(201)
    ).body;
    expect(a2).toMatchObject({ thermo: 'JB8369', chasis: null });
    const historial = (
      await c.get(`/asignaciones?camionId=${rhgc58.id}`).expect(200)
    ).body;
    expect(
      historial.filter((h: { vigente: boolean }) => h.vigente),
    ).toHaveLength(1);
    expect(historial).toHaveLength(3);

    const sug = (
      await c.get(`/asignaciones/sugerencia?conductorId=${luis.id}`).expect(200)
    ).body;
    expect(sug).toMatchObject({
      camionId: rhgc58.id,
      remolqueId: thermo.id,
      tipoRemolque: 'THERMO',
    });

    // Un remolque en la casilla equivocada se rechaza.
    await c
      .post('/asignaciones', {
        camionId: drxr59.id,
        chasisId: thermo.id,
        fechaAsignacion: '2026-10-25',
      })
      .expect(400);
    await c
      .post(`/asignaciones/camion/${rhgc58.id}/liberar`, {
        fecha: '2026-10-26',
      })
      .expect(204);
    expect(
      (await c.get('/asignaciones/tablero').expect(200)).body.find(
        (t: { camion: string }) => t.camion === 'RHGC58',
      ).asignacion,
    ).toBeNull();
  });

  it('elimina solo registros que nada usa y deja copia en auditoría', async () => {
    const cliente = (await c.get('/clientes').expect(200)).body[0];
    const p = (
      await c
        .post('/packings', { nombre: 'planta temporal', clienteId: cliente.id })
        .expect(201)
    ).body;
    await c.delete(`/packings/${p.id}`).expect(204);
    await c.delete(`/packings/${p.id}`).expect(404);
    const historial = (
      await c.get(`/auditoria?entidad=Packing&entidadId=${p.id}`).expect(200)
    ).body;
    expect(historial[0]).toMatchObject({
      accion: 'ELIMINAR',
      referencia: 'PLANTA TEMPORAL',
      eliminado: true,
    });

    // Una empresa con móviles y conductores no se puede eliminar: se desactiva.
    const empresas = (await c.get('/empresas').expect(200)).body;
    const bb = empresas.find(
      (e: { razonSocial: string }) =>
        e.razonSocial === 'TRANSPORTES B&B LIMITADA',
    );
    const r = await c.delete(`/empresas/${bb.id}`).expect(409);
    expect(r.body.message).toMatch(/desactívela/);
  });
});
