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
import {
  GRUPOS_MOVIL,
  TIPOS_REMOLQUE,
  type CodigoTipoMovil,
  type MovilDto,
  type MovilInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { noEncontrado } from '../comun/errores.js';
import { aFecha, aIso } from '../comun/fechas.js';
import {
  Booleano,
  Entero,
  Fecha,
  Id,
  Opcion,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const GRUPOS = [
  'camion',
  'chasis',
  'thermo',
  'plataforma',
  'remolque',
] as const;
type GrupoFiltro = (typeof GRUPOS)[number];

class MovilDtoIn implements MovilInput {
  @Texto('Patente', { max: 10, mayusculas: true }) patente!: string;
  @Texto('Marca', { opcional: true, max: 60, mayusculas: true }) marca?:
    string | null;
  @Texto('Modelo', { opcional: true, max: 60, mayusculas: true }) modelo?:
    string | null;
  @Entero('Año', { opcional: true, min: 1950, max: 2100 }) anio?: number | null;
  @Texto('Color', { opcional: true, max: 30, mayusculas: true }) color?:
    string | null;
  @Texto('N° motor', { opcional: true, max: 40, mayusculas: true })
  numeroMotor?: string | null;
  @Texto('N° chasis', { opcional: true, max: 40, mayusculas: true })
  numeroChasis?: string | null;
  @Id('Tipo') tipoId!: number;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Id('Empresa') empresaId!: number;
  @Fecha('Vencimiento revisión técnica', { opcional: true })
  vencRevisionTecnica?: string | null;
  @Fecha('Vencimiento permiso de circulación', { opcional: true })
  vencPermisoCirculacion?: string | null;
  @Fecha('Vencimiento seguro', { opcional: true }) vencSeguro?: string | null;
}

class FiltroMoviles {
  @Id('Empresa', { opcional: true }) empresaId?: number;
  @Opcion('Grupo', GRUPOS, { opcional: true }) grupo?: GrupoFiltro;
  @Booleano('Solo activos', { opcional: true }) activos?: boolean;
}

export const includeMovil = {
  tipo: true,
  empresa: { include: { categoria: true } },
} satisfies Prisma.MovilInclude;
type Fila = Prisma.MovilGetPayload<{ include: typeof includeMovil }>;

export function aMovilDto(m: Fila): MovilDto {
  return {
    id: m.id,
    patente: m.patente,
    marca: m.marca,
    modelo: m.modelo,
    anio: m.anio,
    color: m.color,
    numeroMotor: m.numeroMotor,
    numeroChasis: m.numeroChasis,
    tipoId: m.tipoId,
    tipo: m.tipo.valor,
    tipoCodigo: m.tipo.codigo as CodigoTipoMovil | null,
    activo: m.activo,
    empresaId: m.empresaId,
    empresa: m.empresa.razonSocial,
    tipoEmpresa: m.empresa.categoria.valor,
    vencRevisionTecnica: aIso(m.vencRevisionTecnica),
    vencPermisoCirculacion: aIso(m.vencPermisoCirculacion),
    vencSeguro: aIso(m.vencSeguro),
  };
}

/** Patente sin espacios, puntos ni guiones (DRXR59). */
const normalizarPatente = (p: string) =>
  p.toUpperCase().replace(/[^A-Z0-9]/g, '');

@Injectable()
export class MovilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
  ) {}

  async listar(f: FiltroMoviles): Promise<MovilDto[]> {
    const codigos: readonly string[] | undefined =
      f.grupo === 'remolque'
        ? TIPOS_REMOLQUE
        : f.grupo
          ? GRUPOS_MOVIL[f.grupo]
          : undefined;
    const filas = await this.prisma.movil.findMany({
      where: {
        empresaId: f.empresaId,
        ...(f.activos ? { activo: true } : {}),
        ...(codigos ? { tipo: { codigo: { in: [...codigos] } } } : {}),
      },
      include: includeMovil,
      orderBy: { patente: 'asc' },
    });
    return filas.map(aMovilDto);
  }

  async obtener(id: number): Promise<MovilDto> {
    const m = await this.prisma.movil.findUnique({
      where: { id },
      include: includeMovil,
    });
    if (!m) throw noEncontrado('El móvil');
    return aMovilDto(m);
  }

  private datos(dto: MovilDtoIn) {
    return {
      ...dto,
      patente: normalizarPatente(dto.patente),
      vencRevisionTecnica: aFecha(dto.vencRevisionTecnica),
      vencPermisoCirculacion: aFecha(dto.vencPermisoCirculacion),
      vencSeguro: aFecha(dto.vencSeguro),
    };
  }

  async crear(dto: MovilDtoIn, u: UsuarioSesion): Promise<MovilDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.refs.catalogo(tx, dto.tipoId, 'TIPO_MOVIL', 'Tipo');
      await this.refs.empresa(tx, dto.empresaId);
      const m = await tx.movil.create({
        data: {
          ...this.datos(dto),
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include: includeMovil,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Movil',
        entidadId: m.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(m),
      });
      return aMovilDto(m);
    });
  }

  async actualizar(
    id: number,
    dto: MovilDtoIn,
    u: UsuarioSesion,
  ): Promise<MovilDto> {
    const antes = await this.prisma.movil.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El móvil');
    return this.prisma.$transaction(async (tx) => {
      await this.refs.catalogo(
        tx,
        dto.tipoId,
        'TIPO_MOVIL',
        'Tipo',
        antes.tipoId,
      );
      await this.refs.empresa(tx, dto.empresaId, antes.empresaId);
      const m = await tx.movil.update({
        where: { id },
        data: {
          ...this.datos(dto),
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
        include: includeMovil,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Movil',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, m),
      });
      return aMovilDto(m);
    });
  }
}

@ApiTags('Mantenedores')
@Controller('moviles')
export class MovilesController {
  constructor(private readonly servicio: MovilesService) {}

  @Get() listar(@Query() f: FiltroMoviles) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  crear(@Body() dto: MovilDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MovilDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }
}

@Module({ controllers: [MovilesController], providers: [MovilesService] })
export class MovilesModule {}
