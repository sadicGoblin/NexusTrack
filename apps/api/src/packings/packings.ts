import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  PackingDto,
  PackingInput,
  UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { noEncontrado } from '../comun/errores.js';
import { Booleano, Id, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

class PackingDtoIn implements PackingInput {
  @Texto('Código', { opcional: true, max: 30, mayusculas: true }) codigo?:
    string | null;
  @Texto('Packing', { max: 120, mayusculas: true }) nombre!: string;
  @Texto('Ubicación', { opcional: true, max: 250, mayusculas: true })
  ubicacion?: string | null;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Id('Cliente') clienteId!: number;
}

class FiltroPackings {
  @Id('Cliente', { opcional: true }) clienteId?: number;
  @Booleano('Solo activos', { opcional: true }) activos?: boolean;
}

const include = { cliente: true } satisfies Prisma.PackingInclude;
type Fila = Prisma.PackingGetPayload<{ include: typeof include }>;

function aDto(p: Fila): PackingDto {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    ubicacion: p.ubicacion,
    activo: p.activo,
    clienteId: p.clienteId,
    cliente: p.cliente.nombre,
  };
}

@Injectable()
export class PackingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
  ) {}

  async listar(f: FiltroPackings): Promise<PackingDto[]> {
    const filas = await this.prisma.packing.findMany({
      where: { clienteId: f.clienteId, ...(f.activos ? { activo: true } : {}) },
      include,
      orderBy: [{ cliente: { nombre: 'asc' } }, { nombre: 'asc' }],
    });
    return filas.map(aDto);
  }

  async obtener(id: number): Promise<PackingDto> {
    const p = await this.prisma.packing.findUnique({ where: { id }, include });
    if (!p) throw noEncontrado('El packing');
    return aDto(p);
  }

  async crear(dto: PackingDtoIn, u: UsuarioSesion): Promise<PackingDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.refs.cliente(tx, dto.clienteId);
      const codigo =
        dto.codigo ||
        (await this.secuencias.siguienteCodigo(tx, 'PACKING', 'PK'));
      const p = await tx.packing.create({
        data: {
          ...dto,
          codigo,
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Packing',
        entidadId: p.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(p),
      });
      return aDto(p);
    });
  }

  async actualizar(
    id: number,
    dto: PackingDtoIn,
    u: UsuarioSesion,
  ): Promise<PackingDto> {
    const antes = await this.prisma.packing.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El packing');
    return this.prisma.$transaction(async (tx) => {
      await this.refs.cliente(tx, dto.clienteId, antes.clienteId);
      const p = await tx.packing.update({
        where: { id },
        data: {
          ...dto,
          codigo: dto.codigo || antes.codigo,
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Packing',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, p),
      });
      return aDto(p);
    });
  }
}

@ApiTags('Mantenedores')
@Controller('packings')
export class PackingsController {
  constructor(private readonly servicio: PackingsService) {}

  @Get() listar(@Query() f: FiltroPackings) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  crear(@Body() dto: PackingDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PackingDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }
}

@Module({ controllers: [PackingsController], providers: [PackingsService] })
export class PackingsModule {}
