import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  catalogoMeta,
  TipoCatalogo,
  type CatalogoItemDto,
  type CatalogoItemInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { invalido, noEncontrado } from '../comun/errores.js';
import { Booleano, Entero, Opcion, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CatalogoItem } from '../generated/prisma/client.js';

const TIPOS = Object.values(TipoCatalogo);

class CatalogoItemDtoIn implements CatalogoItemInput {
  @Opcion('Catálogo', TIPOS) tipo!: TipoCatalogo;
  @Texto('Valor', { max: 120, mayusculas: true }) valor!: string;
  @Entero('Orden', { opcional: true, min: 0 }) orden?: number;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
}

class FiltroCatalogo {
  @Opcion('Catálogo', TIPOS, { opcional: true }) tipo?: TipoCatalogo;
  @Booleano('Solo activos', { opcional: true }) activos?: boolean;
}

export function aCatalogoDto(c: CatalogoItem): CatalogoItemDto {
  return {
    id: c.id,
    tipo: c.tipo,
    valor: c.valor,
    codigo: c.codigo,
    orden: c.orden,
    activo: c.activo,
  };
}

@ApiTags('Catálogos')
@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar(@Query() f: FiltroCatalogo): Promise<CatalogoItemDto[]> {
    const filas = await this.prisma.catalogoItem.findMany({
      where: { tipo: f.tipo, ...(f.activos ? { activo: true } : {}) },
      orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { valor: 'asc' }],
    });
    return filas.map(aCatalogoDto);
  }

  @RequierePermiso('editarCatalogos')
  @Post()
  async crear(
    @Body() dto: CatalogoItemDtoIn,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<CatalogoItemDto> {
    if (catalogoMeta(dto.tipo).sistema) {
      throw invalido(
        'Este catálogo lo usa la lógica del sistema: se pueden renombrar o desactivar valores, pero no crear nuevos.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.catalogoItem.aggregate({
        where: { tipo: dto.tipo },
        _max: { orden: true },
      });
      const item = await tx.catalogoItem.create({
        data: {
          tipo: dto.tipo,
          valor: dto.valor,
          orden: dto.orden ?? (ultimo._max.orden ?? 0) + 1,
          activo: dto.activo ?? true,
          creadoPorId: usuario.id,
          actualizadoPorId: usuario.id,
        },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'CatalogoItem',
        entidadId: item.id,
        accion: 'CREAR',
        usuarioId: usuario.id,
        cambios: this.auditoria.instantanea(item),
      });
      return aCatalogoDto(item);
    });
  }

  @RequierePermiso('editarCatalogos')
  @Put(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CatalogoItemDtoIn,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<CatalogoItemDto> {
    const antes = await this.prisma.catalogoItem.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El valor de catálogo');
    if (antes.tipo !== dto.tipo)
      throw invalido('No se puede mover un valor a otro catálogo.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.catalogoItem.update({
        where: { id },
        data: {
          valor: dto.valor,
          orden: dto.orden ?? antes.orden,
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: usuario.id,
        },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'CatalogoItem',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: usuario.id,
        cambios: this.auditoria.diferencias(antes, item),
      });
      return aCatalogoDto(item);
    });
  }
}
