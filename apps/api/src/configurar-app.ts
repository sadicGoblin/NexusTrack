import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

function mensajes(errores: ValidationError[]): string[] {
  return errores.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...mensajes(e.children ?? []),
  ]);
}

/** Configuración común de la app (también la usan las pruebas de integración). */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Detrás de Caddy u otro proxy de la red privada, la IP real del cliente llega en
  // X-Forwarded-For. Sin esto, el límite de intentos de ingreso sería compartido por todos.
  (app as NestExpressApplication).set(
    'trust proxy',
    'loopback, linklocal, uniquelocal',
  );
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errores) => {
        const lista = [...new Set(mensajes(errores))];
        return new BadRequestException({
          statusCode: 400,
          message: lista[0] ?? 'Datos inválidos.',
          errores: lista,
        });
      },
    }),
  );
  const origen = process.env['CORS_ORIGIN'];
  if (origen) {
    // Necesario cuando la web se publica en otro dominio (por ejemplo, Firebase Hosting).
    app.enableCors({
      origin: origen.split(',').map((o) => o.trim()),
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
      maxAge: 3600,
    });
  }
  app.enableShutdownHooks();
}
