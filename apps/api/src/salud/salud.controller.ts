import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Publico } from '../comun/decoradores.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Endpoint de salud para el monitoreo y el healthcheck del contenedor. */
@ApiTags('Sistema')
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @SkipThrottle()
  @Get()
  async salud() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        estado: 'error',
        baseDeDatos: 'sin conexión',
      });
    }
    return { estado: 'ok', baseDeDatos: 'ok', hora: new Date().toISOString() };
  }
}
