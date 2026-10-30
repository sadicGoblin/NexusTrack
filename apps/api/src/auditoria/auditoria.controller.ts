import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuditoriaDto } from '@nexustrack/shared';
import { RequierePermiso } from '../comun/decoradores.js';
import { FiltroFechasDto } from '../comun/dto.js';
import { Entero, Texto } from '../comun/validacion.js';
import { PrismaService } from '../prisma/prisma.service.js';

class FiltroAuditoria extends FiltroFechasDto {
  @Texto('Entidad', { opcional: true, max: 60 }) entidad?: string;
  @Entero('Id de entidad', { opcional: true, min: 0 }) entidadId?: number;
}

@ApiTags('Administración')
@RequierePermiso('administrar')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@Query() f: FiltroAuditoria): Promise<AuditoriaDto[]> {
    const filas = await this.prisma.auditoria.findMany({
      where: {
        entidad: f.entidad ?? undefined,
        entidadId: f.entidadId ?? undefined,
        fecha: {
          ...(f.desde ? { gte: new Date(`${f.desde}T00:00:00-03:00`) } : {}),
          ...(f.hasta
            ? { lte: new Date(`${f.hasta}T23:59:59.999-03:00`) }
            : {}),
        },
      },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { id: 'desc' },
      take: 2000,
    });
    return filas.map((a) => ({
      id: a.id,
      entidad: a.entidad,
      entidadId: a.entidadId,
      accion: a.accion,
      usuario: a.usuario?.nombre ?? null,
      fecha: a.fecha.toISOString(),
      cambios: a.cambios,
    }));
  }
}
