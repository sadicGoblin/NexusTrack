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
  EmpresaDto,
  EmpresaInput,
  UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { exigirRutValido, noEncontrado } from '../comun/errores.js';
import { Booleano, Correo, Id, Rut, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

class EmpresaDtoIn implements EmpresaInput {
  @Rut('RUT') rut!: string;
  @Texto('Razón social', { max: 150, mayusculas: true }) razonSocial!: string;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Texto('Propietario', { opcional: true, max: 120, mayusculas: true })
  propietario?: string | null;
  @Texto('Fono', { opcional: true, max: 40 }) fono?: string | null;
  @Correo('Email', { opcional: true }) email?: string | null;
  @Id('Categoría') categoriaId!: number;
}

class FiltroEmpresas {
  @Booleano('Solo activas', { opcional: true }) activas?: boolean;
}

const include = { categoria: true } satisfies Prisma.EmpresaInclude;
type Fila = Prisma.EmpresaGetPayload<{ include: typeof include }>;

export function aEmpresaDto(e: Fila): EmpresaDto {
  return {
    id: e.id,
    rut: e.rut,
    razonSocial: e.razonSocial,
    activo: e.activo,
    propietario: e.propietario,
    fono: e.fono,
    email: e.email,
    categoriaId: e.categoriaId,
    categoria: e.categoria.valor,
    categoriaCodigo: e.categoria.codigo,
  };
}

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
  ) {}

  async listar(f: FiltroEmpresas): Promise<EmpresaDto[]> {
    const filas = await this.prisma.empresa.findMany({
      where: f.activas ? { activo: true } : {},
      include,
      orderBy: { razonSocial: 'asc' },
    });
    return filas.map(aEmpresaDto);
  }

  async obtener(id: number): Promise<EmpresaDto> {
    const e = await this.prisma.empresa.findUnique({ where: { id }, include });
    if (!e) throw noEncontrado('La empresa');
    return aEmpresaDto(e);
  }

  async crear(dto: EmpresaDtoIn, u: UsuarioSesion): Promise<EmpresaDto> {
    exigirRutValido(dto.rut);
    return this.prisma.$transaction(async (tx) => {
      await this.refs.catalogo(
        tx,
        dto.categoriaId,
        'CATEGORIA_EMPRESA',
        'Categoría',
      );
      const e = await tx.empresa.create({
        data: {
          ...dto,
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Empresa',
        entidadId: e.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(e),
      });
      return aEmpresaDto(e);
    });
  }

  async actualizar(
    id: number,
    dto: EmpresaDtoIn,
    u: UsuarioSesion,
  ): Promise<EmpresaDto> {
    const antes = await this.prisma.empresa.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('La empresa');
    exigirRutValido(dto.rut, antes.rut);
    return this.prisma.$transaction(async (tx) => {
      await this.refs.catalogo(
        tx,
        dto.categoriaId,
        'CATEGORIA_EMPRESA',
        'Categoría',
        antes.categoriaId,
      );
      const e = await tx.empresa.update({
        where: { id },
        data: {
          ...dto,
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Empresa',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, e),
      });
      return aEmpresaDto(e);
    });
  }
}

@ApiTags('Mantenedores')
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly servicio: EmpresasService) {}

  @Get() listar(@Query() f: FiltroEmpresas) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  crear(@Body() dto: EmpresaDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EmpresaDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }
}

@Module({ controllers: [EmpresasController], providers: [EmpresasService] })
export class EmpresasModule {}
