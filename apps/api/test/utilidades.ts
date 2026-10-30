import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CatalogoItemDto, TipoCatalogo } from '@nexustrack/shared';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

export async function crearApp(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = modulo.createNestApplication({ logger: ['error'] });
  configurarApp(app);
  await app.init();
  return app;
}

export type Cliente = ReturnType<typeof clienteHttp>;

/** Cliente HTTP con sesión: login y helpers por verbo que devuelven la respuesta de supertest. */
export function clienteHttp(app: INestApplication, token: string) {
  const s = () => request(app.getHttpServer());
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => s().get(`/api${url}`).set(auth),
    post: (url: string, body?: object) =>
      s()
        .post(`/api${url}`)
        .set(auth)
        .send(body ?? {}),
    put: (url: string, body: object) =>
      s().put(`/api${url}`).set(auth).send(body),
  };
}

export async function iniciarSesion(
  app: INestApplication,
  email: string,
  password: string,
) {
  const r = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return { cliente: clienteHttp(app, r.body.accessToken), respuesta: r };
}

export async function catalogos(c: Cliente) {
  const lista: CatalogoItemDto[] = (await c.get('/catalogos').expect(200)).body;
  return (tipo: TipoCatalogo, valor: string) => {
    const item = lista.find((x) => x.tipo === tipo && x.valor === valor);
    if (!item) throw new Error(`No existe ${tipo}/${valor} en el catálogo`);
    return item.id;
  };
}
