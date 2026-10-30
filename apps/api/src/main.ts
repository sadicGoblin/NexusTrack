import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap() {
  const produccion = process.env['NODE_ENV'] === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'NexusTrack',
      json: produccion,
      colors: !produccion,
    }),
  });
  configurarApp(app);

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('NexusTrack API')
      .setDescription(
        'API de gestión de fletes: mantenedores, documentos operativos y exportación.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento, {
    customSiteTitle: 'NexusTrack API',
  });

  const puerto = Number(process.env['PORT'] ?? 3100);
  await app.listen(puerto);
  new Logger('Arranque').log(
    `API escuchando en http://localhost:${puerto}/api (documentación en /api/docs)`,
  );
}
await bootstrap();
