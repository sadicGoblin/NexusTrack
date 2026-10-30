import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditoriaService,
    SecuenciasService,
    ReferenciasService,
  ],
  exports: [
    PrismaService,
    AuditoriaService,
    SecuenciasService,
    ReferenciasService,
  ],
})
export class PrismaModule {}
