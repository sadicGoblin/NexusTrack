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

    // La anulación respeta el orden hijo → padre.
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
    // La orden de carga de la prueba anterior quedó anulada: sale de la numeración.
    expect(conGuias.hojaRuta).toBe(1);
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

  describe('cuenta del conductor, corrección y eliminación', () => {
    let operaciones: Cliente;
    const vale = (ordenRetiroId: number, monto: number) =>
      c
        .post('/vales-dinero', {
          ordenRetiroId,
          fechaEntrega: '2026-09-10',
          sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
          monto,
          formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
        })
        .expect(201)
        .then((r) => r.body);

    beforeAll(async () => {
      await c
        .post('/usuarios', {
          email: 'operaciones.docs@test.cl',
          nombre: 'Operaciones',
          rol: 'OPERACIONES',
          password: 'Operaciones123',
        })
        .expect(201);
      operaciones = (
        await iniciarSesion(app, 'operaciones.docs@test.cl', 'Operaciones123')
      ).cliente;
    });

    it('toma el tramo de la primera guía si la cabecera queda vacía', async () => {
      const or = await nuevaOrdenRetiro('2026-09-10');
      const oc = (
        await c
          .post('/ordenes-carga', {
            ordenRetiroId: or.id,
            fechaCarga: '2026-09-10',
            guias: [
              guia(rutas.underslung, 'UNDERSLUNG'),
              guia(rutas.contenedor, 'VIAJE'),
            ],
          })
          .expect(201)
      ).body;
      expect(oc).toMatchObject({
        tramoId: rutas.underslung,
        tramo: 'TALCA - VALPARAISO - UNDERSLUNG',
      });
      await c.delete(`/ordenes-carga/${oc.id}`).expect(204);
      await c.delete(`/ordenes-retiro/${or.id}`).expect(204);
    });

    it('lleva el saldo, deja corregir al administrador y elimina en orden', async () => {
      // Flete rendido: anticipos 60.000 + 40.000, gastos 120.000 → −20.000, en contra del conductor.
      const or = await nuevaOrdenRetiro('2026-09-10');
      const v1 = await vale(or.id, 60000);
      const v2 = await vale(or.id, 40000);
      const oc = (
        await c
          .post('/ordenes-carga', {
            ordenRetiroId: or.id,
            fechaCarga: '2026-09-10',
            guias: [guia(rutas.contenedor, 'VIAJE')],
          })
          .expect(201)
      ).body;
      const rd = (
        await c
          .post('/rendiciones', {
            ordenCargaId: oc.id,
            fecha: '2026-09-12',
            peajes: 100000,
            petroleo: 20000,
            horometroInicial: 1520.5,
            horometroFinal: 1532.8,
            remolqueConMotor: true,
            viaticos: [],
            gastos: [],
          })
          .expect(201)
      ).body;
      expect(rd).toMatchObject({
        petroleo: 20000,
        horasMotor: 12.3,
        remolqueConMotor: true,
        totalGeneral: 120000,
      });
      const horometroAlReves = await c.put(`/rendiciones/${rd.id}`, {
        ordenCargaId: oc.id,
        fecha: '2026-09-12',
        horometroInicial: 10,
        horometroFinal: 5,
        viaticos: [],
        gastos: [],
      });
      expect(horometroAlReves.status).toBe(400);
      expect(horometroAlReves.body.message).toMatch(/horómetro final/);
      // Otro flete con anticipo y sin rendir.
      const otra = await nuevaOrdenRetiro('2026-09-11');
      const v3 = await vale(otra.id, 30000);

      const cuenta = (
        await c.get(`/cuentas-conductores/${base.conductor}`).expect(200)
      ).body;
      const flete = cuenta.fletes.find(
        (f: { ordenRetiroId: number }) => f.ordenRetiroId === or.id,
      );
      expect(flete).toMatchObject({
        anticipos: 100000,
        rendido: 120000,
        resultado: -20000,
        rendicionNumero: rd.numero,
      });
      expect(cuenta.saldo).toBe(
        cuenta.fletes.reduce(
          (s: number, f: { resultado: number | null }) =>
            s + (f.resultado ?? 0),
          0,
        ),
      );
      expect(cuenta.porRendir).toBeGreaterThanOrEqual(30000);
      const lista = (await c.get('/cuentas-conductores').expect(200)).body;
      expect(
        lista.find(
          (x: { conductorId: number }) => x.conductorId === base.conductor,
        ),
      ).toMatchObject({ saldo: cuenta.saldo, porRendir: cuenta.porRendir });

      // Documentos cerrados: solo el administrador los corrige.
      const entradaCarga = {
        ordenRetiroId: or.id,
        tramoId: rutas.contenedor,
        fechaCarga: '2026-09-10',
        horaCarga: '07:30',
        guias: [guia(rutas.contenedor, 'VIAJE')],
      };
      await operaciones
        .put(`/ordenes-carga/${oc.id}`, entradaCarga)
        .expect(409);
      expect(
        (await c.put(`/ordenes-carga/${oc.id}`, entradaCarga).expect(200)).body,
      ).toMatchObject({ estado: 'RENDIDA', horaCarga: '07:30' });
      const cerrada = (await c.get(`/ordenes-retiro/${or.id}`).expect(200))
        .body;
      expect(cerrada.estado).toBe('CERRADA');
      await operaciones.put(`/ordenes-retiro/${or.id}`, cerrada).expect(409);
      await c
        .put(`/ordenes-retiro/${or.id}`, { ...cerrada, mtb: 'MTB-1' })
        .expect(200);

      // Solo el administrador elimina, y siempre del hijo al padre.
      await operaciones.delete(`/vales-dinero/${v1.id}`).expect(403);
      expect(
        (await c.delete(`/ordenes-retiro/${or.id}`).expect(409)).body.message,
      ).toMatch(/elimine primero la orden de carga N° \d+, el vale de dinero/);
      expect(
        (await c.delete(`/ordenes-carga/${oc.id}`).expect(409)).body.message,
      ).toMatch(/rendición N° \d+: elimínela primero/);
      await c.delete(`/rendiciones/${rd.id}`).expect(204);
      expect(
        (await c.get(`/ordenes-carga/${oc.id}`).expect(200)).body.estado,
      ).toBe('ABIERTA');
      expect(
        (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
      ).toBe('CON_CARGA');
      await c.delete(`/ordenes-carga/${oc.id}`).expect(204);
      expect(
        (await c.get(`/ordenes-retiro/${or.id}`).expect(200)).body.estado,
      ).toBe('ABIERTA');
      for (const v of [v1, v2, v3])
        await c.delete(`/vales-dinero/${v.id}`).expect(204);
      await c.delete(`/ordenes-retiro/${or.id}`).expect(204);
      await c.delete(`/ordenes-retiro/${otra.id}`).expect(204);
      await c.get(`/ordenes-retiro/${or.id}`).expect(404);
      await c.delete(`/ordenes-retiro/${or.id}`).expect(404);

      // La auditoría conserva quién eliminó y cómo se reconocía el documento.
      const historial = (
        await c
          .get(`/auditoria?entidad=OrdenCarga&entidadId=${oc.id}`)
          .expect(200)
      ).body;
      expect(historial[0]).toMatchObject({
        accion: 'ELIMINAR',
        referencia: `N° ${String(oc.numero).padStart(6, '0')}`,
        eliminado: true,
        usuario: 'Administrador',
      });
      expect(historial[0].cambios.guias).toHaveLength(1);
      expect(historial.map((h: { accion: string }) => h.accion)).toEqual([
        'ELIMINAR',
        'EDITAR',
        'CREAR',
      ]);
    });
  });

  it('calcula el control de fletes y las órdenes por facturar del período', async () => {
    const or = await nuevaOrdenRetiro('2026-08-05');
    const oc = (
      await c
        .post('/ordenes-carga', {
          ordenRetiroId: or.id,
          tramoId: rutas.contenedor,
          fechaCarga: '2026-08-06',
          guias: [
            guia(rutas.contenedor, 'VIAJE'),
            { ...guia(rutas.contenedor, 'VIAJE'), numeroGuia: '7350' },
            guia(rutas.underslung, 'UNDERSLUNG'),
          ],
        })
        .expect(201)
    ).body;
    const vale = (
      await c
        .post('/vales-dinero', {
          ordenRetiroId: or.id,
          fechaEntrega: '2026-08-05',
          sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
          monto: 150000,
          formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
        })
        .expect(201)
    ).body;
    await c
      .post('/vales-combustible', {
        ordenRetiroId: or.id,
        fechaEntrega: '2026-08-07',
        sitioEntregaId: id('SITIO_ENTREGA', 'SAN ANTONIO'),
        camionId: or.camionId,
        remolqueId: or.remolqueId,
        numeralInicialCamion: 1000,
        numeralFinalCamion: 1150,
        numeralInicialRemolque: 50,
        numeralFinalRemolque: 74,
        valorLitro: 1000,
      })
      .expect(201);
    const rendicion = (
      await c
        .post('/rendiciones', {
          ordenCargaId: oc.id,
          fecha: '2026-08-08',
          fechaSalida: '2026-08-06',
          fechaLlegada: '2026-08-07',
          odometroInicial: 1000,
          odometroFinal: 1450,
          horometroInicial: 100,
          horometroFinal: 112,
          peajes: 12000,
          carga: 5000,
          descarga: 5000,
          petroleo: 20000,
          viaticos: [{ fecha: '2026-08-06', almuerzo: 6000 }],
          gastos: [{ monto: 4000 }],
        })
        .expect(201)
    ).body;
    const conductor = (
      await c.get(`/conductores/${base.conductor}`).expect(200)
    ).body;
    const comisiones = Math.round(oc.totalNeto * (conductor.comision ?? 0));

    const periodo = '?desde=2026-08-01&hasta=2026-08-31';
    const control = (
      await c.get(`/informes/control-fletes${periodo}`).expect(200)
    ).body;
    expect(control).toHaveLength(1);
    expect(control[0]).toMatchObject({
      id: `C${oc.id}`,
      ordenCargaId: oc.id,
      estado: 'RENDIDA',
      ordenRetiro: or.numero,
      rendicion: rendicion.numero,
      fechaInicio: '2026-08-06',
      fechaTermino: '2026-08-07',
      numerosAnticipo: String(vale.numero).padStart(6, '0'),
      distancia: 450,
      litrosCamion: 150,
      kmPorLitro: 3,
      horometro: 12,
      litrosRemolque: 24,
      litrosPorHora: 2,
      anticipo: 150000,
      cargaDescarga: 10000,
      petroleo: 20000,
      totalGastos: 52000,
      saldo: 98000,
      combustible: 174000,
      comisiones,
      costoTotal: 226000 + comisiones,
      valorFlete: oc.totalNeto,
      margen: oc.totalNeto - 226000 - comisiones,
    });
    expect(
      (
        await c
          .get(`/informes/control-fletes${periodo}&clienteId=${base.propal}`)
          .expect(200)
      ).body,
    ).toEqual([]);

    const resumen = (await c.get(`/informes/facturacion${periodo}`).expect(200))
      .body;
    expect(resumen).toEqual([
      expect.objectContaining({
        clienteId: base.cliente,
        ordenes: 1,
        guias: 3,
        total: oc.totalNeto,
      }),
    ]);
    const informe = (
      await c.get(`/informes/facturacion/${base.cliente}${periodo}`).expect(200)
    ).body;
    expect(informe.total).toBe(oc.totalNeto);
    expect(
      informe.lineas.map((l: { guias: string; cantidadTarifa: number }) => [
        l.guias,
        l.cantidadTarifa,
      ]),
    ).toEqual([
      ['7349 - 7350', 2],
      ['7349', 1],
    ]);

    const pdf = await c
      .get(`/informes/facturacion/${base.cliente}/pdf${periodo}`)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toMatch(
      /por-facturar-coexca-s-a-2026-08-01-2026-08-31\.pdf/,
    );
    const xlsx = await c
      .get(`/informes/facturacion/${base.cliente}/xlsx${periodo}`)
      .expect(200);
    expect(xlsx.headers['content-type']).toMatch(/spreadsheetml/);
    await c
      .post('/exportacion/tabla', {
        titulo: 'Control de fletes',
        formato: 'pdf',
        columnas: [
          { campo: 'conductor', titulo: 'Conductor' },
          { campo: 'margen', titulo: 'Margen', tipo: 'pesos' },
        ],
        filas: control,
        totales: { margen: control[0].margen },
      })
      .expect(201);
  });

  it('numera las hojas de ruta por fecha e incluye las estadías con sus vales', async () => {
    const conGuia = async (fecha: string) => {
      const or = await nuevaOrdenRetiro(fecha);
      return (
        await c
          .post('/ordenes-carga', {
            ordenRetiroId: or.id,
            fechaCarga: fecha,
            guias: [guia(rutas.contenedor, 'VIAJE')],
          })
          .expect(201)
      ).body;
    };
    const hoja = async (clave: string) =>
      (await c.get(`/hojas-ruta/${clave}`).expect(200)).body.numero as number;

    const posterior = await conGuia('2026-07-10');
    // Ingresada después pero cargada antes: toma el N° anterior y corre al otro.
    const anterior = await conGuia('2026-07-05');
    expect(anterior.hojaRuta).toBe(posterior.hojaRuta);
    expect(await hoja(`C${posterior.id}`)).toBe(anterior.hojaRuta + 1);

    const sug = (
      await c
        .get(`/asignaciones/sugerencia?conductorId=${base.conductor}`)
        .expect(200)
    ).body;
    const estadia = (
      await c
        .post('/rendiciones', {
          tipo: 'ESTADIA',
          conductorId: base.conductor,
          camionId: sug.camionId,
          remolqueId: sug.remolqueId,
          destinoId: id('CIUDAD', 'SAN ANTONIO'),
          fecha: '2026-07-08',
          fechaSalida: '2026-07-07',
          viaticos: [{ fecha: '2026-07-07', almuerzo: 8000 }],
          gastos: [],
        })
        .expect(201)
    ).body;
    expect(estadia).toMatchObject({
      tipo: 'ESTADIA',
      ordenCargaId: null,
      origen: 'ESTADÍA',
      destino: 'SAN ANTONIO',
      patenteCamion: 'DRXR59',
      totalGeneral: 8000,
      hojaRuta: anterior.hojaRuta + 1,
    });
    expect(await hoja(`C${posterior.id}`)).toBe(anterior.hojaRuta + 2);
    // Una estadía necesita conductor, camión, lugar e inicio.
    await c
      .post('/rendiciones', {
        tipo: 'ESTADIA',
        conductorId: base.conductor,
        fecha: '2026-07-08',
        viaticos: [],
        gastos: [],
      })
      .expect(400);

    const julio = '?desde=2026-07-01&hasta=2026-07-31';
    const hojas = (await c.get(`/hojas-ruta${julio}`).expect(200)).body;
    expect(
      hojas.map((h: { tipo: string; origen: string; destino: string }) => [
        h.tipo,
        h.origen,
        h.destino,
      ]),
    ).toEqual([
      ['FLETE', 'TALCA', 'VALPARAISO'],
      ['ESTADIA', 'ESTADÍA', 'SAN ANTONIO'],
      ['FLETE', 'TALCA', 'VALPARAISO'],
    ]);
    expect(hojas[1]).toMatchObject({ totalGastos: 8000, viaticos: 8000 });

    // Anticipo de la estadía: vale de dinero que apunta a ella (nunca a ambas).
    const vale = (
      await c
        .post('/vales-dinero', {
          estadiaId: estadia.id,
          fechaEntrega: '2026-07-07',
          sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
          monto: 20000,
          formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
        })
        .expect(201)
    ).body;
    expect(vale).toMatchObject({
      retiro: null,
      estadia: { id: estadia.id, destino: 'SAN ANTONIO' },
    });
    await c
      .post('/vales-dinero', {
        ordenRetiroId: anterior.ordenRetiroId,
        estadiaId: estadia.id,
        fechaEntrega: '2026-07-07',
        sitioEntregaId: id('SITIO_ENTREGA', 'CURICO'),
        monto: 1,
        formaPagoId: id('FORMA_PAGO', 'EFECTIVO'),
      })
      .expect(400);

    const cuenta = (
      await c.get(`/cuentas-conductores/${base.conductor}`).expect(200)
    ).body;
    expect(
      cuenta.fletes.find(
        (f: { clave: string }) => f.clave === `E${estadia.id}`,
      ),
    ).toMatchObject({ anticipos: 20000, rendido: 8000, resultado: 12000 });

    const control = (
      await c.get(`/informes/control-fletes${julio}`).expect(200)
    ).body;
    expect(
      control.find((f: { tipo: string }) => f.tipo === 'ESTADIA'),
    ).toMatchObject({
      cliente: null,
      tramo: 'ESTADÍA - SAN ANTONIO',
      anticipo: 20000,
      totalGastos: 8000,
      valorFlete: 0,
      margen: -8000,
    });
    expect(
      (
        await c
          .get(`/informes/control-fletes${julio}&clienteId=${base.cliente}`)
          .expect(200)
      ).body.map((f: { tipo: string }) => f.tipo),
    ).toEqual(['FLETE', 'FLETE']);

    const pdf = await c.get(`/hojas-ruta/E${estadia.id}/pdf`).expect(200);
    expect(pdf.headers['content-disposition']).toMatch(/hoja-ruta-0+\d+\.pdf/);

    // Del hijo al padre: el vale antes que la estadía. Anulada, sale de la numeración.
    expect(
      (await c.post(`/rendiciones/${estadia.id}/anular`, { motivo: 'prueba' }))
        .body.message,
    ).toMatch(/vale de dinero N°/);
    await c
      .post(`/vales-dinero/${vale.id}/anular`, { motivo: 'prueba' })
      .expect(201);
    await c
      .post(`/rendiciones/${estadia.id}/anular`, { motivo: 'prueba' })
      .expect(201);
    await c.get(`/hojas-ruta/E${estadia.id}`).expect(404);
    expect(await hoja(`C${posterior.id}`)).toBe(anterior.hojaRuta + 1);

    // El N° inicial continúa la numeración de la planilla.
    await c
      .put('/parametros/HOJA_RUTA_INICIAL', { valor: '25332' })
      .expect(200);
    const primera = (await c.get('/hojas-ruta').expect(200)).body.at(-1);
    expect(primera.numero).toBe(25332);
    await c.put('/parametros/HOJA_RUTA_INICIAL', { valor: 'abc' }).expect(400);
    await c.put('/parametros/HOJA_RUTA_INICIAL', { valor: '1' }).expect(200);
  });
});
