import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  clienteHttp,
  crearApp,
  iniciarSesion,
  type Cliente,
} from './utilidades.js';

describe('Acceso y permisos', () => {
  let app: INestApplication;
  let admin: Cliente;

  beforeAll(async () => {
    app = await crearApp();
    admin = (await iniciarSesion(app, 'admin@nexustrack.cl', 'Admin123!'))
      .cliente;
  });
  afterAll(() => app.close());

  it('rechaza credenciales incorrectas sin revelar si el correo existe', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@nexustrack.cl', password: 'mala1234' });
    const b = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nadie@x.cl', password: 'mala1234' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('exige sesión en los endpoints protegidos y deja libre el de salud', async () => {
    await request(app.getHttpServer()).get('/api/empresas').expect(401);
    await request(app.getHttpServer()).get('/api/salud').expect(200);
  });

  it('entrega cookie httpOnly de refresco y permite renovar la sesión', async () => {
    const { respuesta } = await iniciarSesion(
      app,
      'admin@nexustrack.cl',
      'Admin123!',
    );
    const cookie = respuesta.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/nt_refresh=.+HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    const r = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    expect(r.body.usuario.rol).toBe('ADMIN');
    await clienteHttp(app, r.body.accessToken).get('/auth/me').expect(200);
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('aplica la matriz de permisos por rol', async () => {
    await admin
      .post('/usuarios', {
        email: 'lectura@test.cl',
        nombre: 'Lectura',
        rol: 'LECTURA',
        password: 'Lectura123',
      })
      .expect(201);
    await admin
      .post('/usuarios', {
        email: 'finanzas@test.cl',
        nombre: 'Finanzas',
        rol: 'FINANZAS',
        password: 'Finanzas123',
      })
      .expect(201);
    const lectura = (await iniciarSesion(app, 'lectura@test.cl', 'Lectura123'))
      .cliente;
    const finanzas = (
      await iniciarSesion(app, 'finanzas@test.cl', 'Finanzas123')
    ).cliente;

    await lectura.get('/empresas').expect(200);
    const r = await lectura.post('/clientes', {
      rut: '76.123.456-0',
      nombre: 'X',
    });
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/permiso/);
    await lectura.get('/usuarios').expect(403);
    await finanzas.post('/ordenes-retiro', {}).expect(403);
    // Finanzas sí puede editar tarifas: la validación responde 400 (pasó el permiso).
    await finanzas.post('/rutas-tarifas', {}).expect(400);
  });

  it('exige contraseñas seguras y no deja al administrador quitarse su propio rol', async () => {
    await admin
      .post('/usuarios', {
        email: 'debil@test.cl',
        nombre: 'Débil',
        rol: 'LECTURA',
        password: 'corta',
      })
      .expect(400);
    const yo = (await admin.get('/auth/me').expect(200)).body;
    await admin
      .put(`/usuarios/${yo.id}`, {
        email: yo.email,
        nombre: yo.nombre,
        rol: 'LECTURA',
      })
      .expect(400);
  });

  it('invalida las sesiones de un usuario desactivado', async () => {
    const creado = (
      await admin
        .post('/usuarios', {
          email: 'temporal@test.cl',
          nombre: 'Temporal',
          rol: 'OPERACIONES',
          password: 'Temporal123',
        })
        .expect(201)
    ).body;
    const { respuesta } = await iniciarSesion(
      app,
      'temporal@test.cl',
      'Temporal123',
    );
    const cookie = respuesta.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    await admin
      .put(`/usuarios/${creado.id}`, {
        email: creado.email,
        nombre: creado.nombre,
        rol: 'OPERACIONES',
        activo: false,
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'temporal@test.cl', password: 'Temporal123' })
      .expect(401);
  });
});
