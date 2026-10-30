import type { INestApplication } from '@nestjs/common';
import {
  catalogos,
  crearApp,
  iniciarSesion,
  type Cliente,
} from './utilidades.js';

describe('Documentos operativos: flujo completo', () => {
  let app: INestApplication;
  let c: Cliente;
  let id: Awaited<ReturnType<typeof catalogos>>;
  let base: Record<string, number>;
  let rutas: { contenedor: number; underslung: number; propal: number };

  beforeAll(async () => {
    app = await crearApp();
    c = (await iniciarSesion(app, 'admin@nexustrack.cl', 'Admin123!')).cliente;
    id = await catalogos(c);
    const conductores = (await c.get('/conductores').expect(200)).body;
    const camiones = (await c.get('/moviles?grupo=camion').expect(200)).body;
    const remolques = (await c.get('/moviles?grupo=remolque').expect(200)).body;
    const clientes = (await c.get('/clientes').expect(200)).body;
    const fernando = conductores.find((x: { nombre: string }) =>
      x.nombre.startsWith('FERNANDO'),
    );
    const drxr59 = camiones.find(
      (m: { patente: string }) => m.patente === 'DRXR59',
    );
    const jh7077 = remolques.find(
      (m: { patente: string }) => m.patente === 'JH7077',
    );
    await c
      .post('/asignaciones', {
        camionId: drxr59.id,
        conductorId: fernando.id,
        chasisId: jh7077.id,
        fechaAsignacion: '2026-10-01',
      })
      .expect(201);
    const coexca = clientes.find((x: { nombre: string }) =>
      x.nombre.startsWith('COEXCA'),
    );
    const propal = clientes.find((x: { nombre: string }) =>
      x.nombre.includes('PROPAL'),
    );
    base = { conductor: fernando.id, cliente: coexca.id, propal: propal.id };
    const tarifas = (await c.get('/rutas-tarifas').expect(200)).body as {
      id: number;
      tramo: string;
    }[];
    const ruta = (t: string) => tarifas.find((r) => r.tramo === t)!.id;
    rutas = {
      contenedor: ruta('TALCA - VALPARAISO - CONTENEDOR'),
      underslung: ruta('TALCA - VALPARAISO - UNDERSLUNG'),
      propal: ruta('TUNICHE - HIJUELAS - THERMO'),
    };
  });
  afterAll(() => app.close());

  async function nuevaOrdenRetiro(fecha = '2026-10-20') {
    const sug = (
      await c
        .get(`/asignaciones/sugerencia?conductorId=${base.conductor}`)
        .expect(200)
    ).body;
    return (
      await c
        .post('/ordenes-retiro', {
          fecha,
          trazabilidadId: id('TRAZABILIDAD', 'DEPÓSITO-PLANTA-PUERTO'),
          conductorId: base.conductor,
          camionId: sug.camionId,
          remolqueId: sug.remolqueId,
          empresaId: sug.empresaId,
          clienteId: base.cliente,
          origenId: id('CIUDAD', 'TALCA'),
          destinoId: id('CIUDAD', 'VALPARAISO'),
          depositoRetiroId: id('DEPOSITO', 'MEDLOG SAN ANTONIO'),
          puertoEmbarqueId: id('PUERTO_EMBARQUE', 'PUERTO VALPARAISO'),
          fechaCarga: fecha,
          horaCarga: '08:00',
        })
        .expect(201)
    ).body;
  }

  const guia = (tramoId: number, umTarifa: string) => ({
    numeroGuia: '7349',
    fechaGuia: '2026-10-15',
    especieId: id('ESPECIE', 'CONTENEDOR'),
    umEspecieId: id('UM_ESPECIE', 'PALLETS'),
    cantidadEspecie: 20,
    numeroContenedor: 'BUN38483483',
    tramoId,
    umTarifaId: id('UM_TARIFA', umTarifa),
    cantidadTarifa: 1,
  });

  it('recorre retiro → carga → vales → rendición con estados y totales correctos', async () => {
    const or = await nuevaOrdenRetiro();
    expect(or).toMatchObject({
      numero: 1,
      estado: 'ABIERTA',
      camion: 'DRXR59',
      remolque: 'JH7077',
      tipoRemolque: 'CHASIS C/MOTOR',
      empresa: 'TRANSPORTES B&B LIMITADA',
    });

    // Orden de carga con el ejemplo de la planilla: total neto $645.000.
    const oc = (
      await c
        .post('/ordenes-carga', {
          ordenRetiroId: or.id,
          tramoId: rutas.contenedor,
          fechaCarga: '2026-10-15',
          guias: [
            guia(rutas.contenedor, 'VIAJE'),
            guia(rutas.underslung, 'UNDERSLUNG'),
          ],
        })
        .expect(201)
    ).body;
    expect(oc).toMatchObject({
      numero: 1,
      hojaRuta: 1,
      totalNeto: 645000,
      patenteCamion: 'DRXR59',
      patenteRemolque: 'JH7077',
    });
    expect(
      oc.guias.map((g: { valorUnitario: number }) => g.valorUnitario),
    ).toEqual([565000, 80000]);
    expect(
      (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
    ).toBe('CON_CARGA');

    // Un tramo de otro cliente se rechaza.
    const ajeno = await c.put(`/ordenes-carga/${oc.id}`, {
      ordenRetiroId: or.id,
      fechaCarga: '2026-10-15',
      guias: [guia(rutas.propal, 'VIAJE')],
    });
    expect(ajeno.status).toBe(400);
    expect(ajeno.body.message).toMatch(/no corresponde al cliente/);

    // Valor unitario editable: se respeta el valor enviado.
    const editada = (
      await c
        .put(`/ordenes-carga/${oc.id}`, {
          ordenRetiroId: or.id,
          tramoId: rutas.contenedor,
          fechaCarga: '2026-10-15',
          guias: [
            guia(rutas.contenedor, 'VIAJE'),
            {
              ...guia(rutas.underslung, 'UNDERSLUNG'),
              cantidadTarifa: 2,
              valorUnitario: 75000,
            },
          ],
        })
        .expect(200)
    ).body;
    expect(editada).toMatchObject({ totalNeto: 715000, hojaRuta: 1 });

    const vd = (
      await c
        .post('/vales-dinero', {
          ordenRetiroId: or.id,
          fechaEntrega: '2026-10-20',
          sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
          monto: 150000,
          formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
        })
        .expect(201)
    ).body;
    expect(vd).toMatchObject({ numero: 1, concepto: 'FLETE', monto: 150000 });

    const vc = (
      await c
        .post('/vales-combustible', {
          ordenRetiroId: or.id,
          fechaEntrega: '2026-10-21',
          sitioEntregaId: id('SITIO_ENTREGA', 'SAN ANTONIO'),
          camionId: or.camionId,
          remolqueId: or.remolqueId,
          numeralInicialCamion: 1000.5,
          numeralFinalCamion: 1200.75,
          numeralInicialRemolque: 50,
          numeralFinalRemolque: 80,
          valorLitro: 1000,
        })
        .expect(201)
    ).body;
    expect(vc).toMatchObject({
      litrosCamion: 200.25,
      litrosRemolque: 30,
      totalLitros: 230.25,
      total: 230250,
    });
    await c
      .post('/vales-combustible', {
        ordenRetiroId: or.id,
        fechaEntrega: '2026-10-21',
        sitioEntregaId: id('SITIO_ENTREGA', 'SAN ANTONIO'),
        camionId: or.camionId,
        numeralInicialCamion: 100,
        numeralFinalCamion: 50,
        valorLitro: 1000,
      })
      .expect(400);

    const rd = (
      await c
        .post('/rendiciones', {
          ordenCargaId: oc.id,
          fecha: '2026-10-22',
          odometroInicial: 1000,
          odometroFinal: 1374,
          peajes: 12000,
          carga: 5000,
          descarga: 5000,
          viaticos: [
            {
              fecha: '2026-10-15',
              desayuno: 3000,
              almuerzo: 6000,
              comida: 5000,
            },
          ],
          gastos: [
            {
              tipoDocumentoId: id('TIPO_DOCUMENTO', 'BOLETA'),
              monto: 4000,
              itemGastoId: id('ITEM_GASTO', 'PASAJES'),
            },
            { monto: 1000 },
          ],
        })
        .expect(201)
    ).body;
    expect(rd).toMatchObject({
      numero: 1,
      kmRecorridos: 374,
      totalViaticos: 14000,
      totalOtrosGastos: 5000,
      totalGeneral: 41000,
    });
    expect(
      (await c.get(`/ordenes-carga/${oc.id}`).expect(200)).body.estado,
    ).toBe('RENDIDA');
    expect(
      (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
    ).toBe('CERRADA');

    // Documentos cerrados no se editan; la anulación respeta el orden hijo → padre.
    await c.put(`/ordenes-retiro/${or.id}`, { ...or }).expect(409);
    expect(
      (await c.post(`/ordenes-carga/${oc.id}/anular`, { motivo: 'prueba' }))
        .body.message,
    ).toMatch(/rendición N° 1/);
    await c
      .post(`/rendiciones/${rd.id}/anular`, { motivo: 'error de digitación' })
      .expect(201);
    expect(
      (await c.get(`/ordenes-carga/${oc.id}`).expect(200)).body.estado,
    ).toBe('ABIERTA');
    expect(
      (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
    ).toBe('CON_CARGA');
    await c
      .post(`/ordenes-carga/${oc.id}/anular`, { motivo: 'prueba' })
      .expect(201);
    expect(
      (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
    ).toBe('ABIERTA');
    expect(
      (await c.post(`/ordenes-retiro/${or.id}/anular`, { motivo: 'prueba' }))
        .body.message,
    ).toMatch(/vales/);
    await c
      .post(`/vales-dinero/${vd.id}/anular`, { motivo: 'prueba' })
      .expect(201);
    await c
      .post(`/vales-combustible/${vc.id}/anular`, { motivo: 'prueba' })
      .expect(201);
    const anulada = (
      await c
        .post(`/ordenes-retiro/${or.id}/anular`, { motivo: 'flete cancelado' })
        .expect(201)
    ).body;
    expect(anulada).toMatchObject({
      estado: 'ANULADA',
      motivoAnulacion: 'flete cancelado',
    });
    await c
      .post('/vales-dinero', {
        ordenRetiroId: or.id,
        fechaEntrega: '2026-10-20',
        sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
        monto: 1,
        formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
      })
      .expect(409);

    const historial = (
      await c
        .get(`/auditoria?entidad=OrdenRetiro&entidadId=${or.id}`)
        .expect(200)
    ).body;
    expect(historial.map((h: { accion: string }) => h.accion)).toEqual([
      'ANULAR',
      'CREAR',
    ]);
  });

  it('no permite rendir una orden de carga sin guías ni crear dos cargas para un mismo retiro', async () => {
    const or = await nuevaOrdenRetiro('2026-10-23');
    const oc = (
      await c
        .post('/ordenes-carga', {
          ordenRetiroId: or.id,
          fechaCarga: '2026-10-23',
          guias: [],
        })
        .expect(201)
    ).body;
    expect(oc.hojaRuta).toBeNull();
    expect(
      (
        await c.post('/rendiciones', {
          ordenCargaId: oc.id,
          fecha: '2026-10-23',
          viaticos: [],
          gastos: [],
        })
      ).body.message,
    ).toMatch(/Registre las guías/);
    await c
      .post('/ordenes-carga', {
        ordenRetiroId: or.id,
        fechaCarga: '2026-10-23',
        guias: [],
      })
      .expect(409);
    const conGuias = (
      await c
        .put(`/ordenes-carga/${oc.id}`, {
          ordenRetiroId: or.id,
          fechaCarga: '2026-10-23',
          guias: [guia(rutas.contenedor, 'VIAJE')],
        })
        .expect(200)
    ).body;
    expect(conGuias.hojaRuta).toBe(2);
    const porRendir = (await c.get('/ordenes-carga?porRendir=true').expect(200))
      .body;
    expect(porRendir.map((x: { id: number }) => x.id)).toContain(oc.id);
  });

  it('asigna correlativos sin saltos ni duplicados bajo concurrencia', async () => {
    const creadas = await Promise.all(
      Array.from({ length: 8 }, () => nuevaOrdenRetiro('2026-11-02')),
    );
    const numeros = creadas.map((o) => o.numero).sort((a, b) => a - b);
    expect(new Set(numeros).size).toBe(8);
    expect(numeros[7] - numeros[0]).toBe(7);
  });

  it('filtra los listados por día, rango y estado', async () => {
    expect(
      (
        await c
          .get('/ordenes-retiro?desde=2026-11-02&hasta=2026-11-02')
          .expect(200)
      ).body,
    ).toHaveLength(8);
    expect(
      (
        await c
          .get('/ordenes-retiro?desde=2026-10-01&hasta=2026-10-31')
          .expect(200)
      ).body,
    ).toHaveLength(2);
    expect(
      (await c.get('/ordenes-retiro?estado=ANULADA').expect(200)).body,
    ).toHaveLength(1);
    expect(
      (await c.get('/ordenes-retiro?sinCarga=true').expect(200)).body,
    ).toHaveLength(8);
    await c.get('/ordenes-retiro?desde=2026-13-01').expect(400);
  });

  it('exporta documentos y listados a PDF y Excel', async () => {
    const or = (await c.get('/ordenes-retiro?estado=ABIERTA').expect(200))
      .body[0];
    const pdf = await c
      .get(`/ordenes-retiro/${or.id}/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (d: Buffer) => partes.push(d));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.headers['content-disposition']).toMatch(
      /orden-retiro-0000\d\d\.pdf/,
    );

    const xlsx = await c.get(`/ordenes-retiro/${or.id}/xlsx`).expect(200);
    expect(xlsx.headers['content-type']).toMatch(/spreadsheetml/);

    const listado = await c
      .post('/exportacion/tabla', {
        titulo: 'Órdenes de retiro',
        formato: 'xlsx',
        columnas: [
          { campo: 'numero', titulo: 'N°', tipo: 'numero' },
          { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
        ],
        filas: [{ numero: 1, fecha: '2026-10-20' }],
      })
      .expect(201);
    expect(listado.headers['content-disposition']).toMatch(
      /ordenes-de-retiro\.xlsx/,
    );
  });

  it('resume el estado de la operación en el inicio', async () => {
    const inicio = (await c.get('/inicio').expect(200)).body;
    expect(inicio.contadores).toMatchObject({
      retirosSinCarga: 8,
      cargasPorRendir: 1,
      tarifasVencidas: 4,
    });
  });
});
