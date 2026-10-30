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
  TipoConductor,
  type ConductorDto,
  type ConductorInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { exigirRutValido, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso } from '../comun/fechas.js';
import {
  Booleano,
  Decimal,
  Fecha,
  Id,
  Opcion,
  Rut,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

class ConductorDtoIn implements ConductorInput {
  @Rut('RUT') rut!: string;
  @Texto('Nombre', { max: 150, mayusculas: true }) nombre!: string;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Opcion('Tipo', Object.values(TipoConductor)) tipo!: TipoConductor;
  @Id('Empresa') empresaId!: number;
  @Decimal('% Comisión', {
    opcional: true,
    min: 0,
    max: 1,
    decimales: 4,
    descripcion: 'Fracción: 0.08 = 8 %',
  })
  comision?: number | null;
  @Texto('N° licencia', { opcional: true, max: 40, mayusculas: true })
  numeroLicencia?: string | null;
  @Fecha('Vencimiento licencia', { opcional: true }) vencLicencia?:
    string | null;
  @Fecha('Fecha ingreso', { opcional: true }) fechaIngreso?: string | null;
  @Fecha('Término contrato', { opcional: true }) terminoContrato?:
    string | null;
  @Texto('Dirección', { opcional: true, max: 250, mayusculas: true })
  direccion?: string | null;
  @Texto('Teléfono móvil', { opcional: true, max: 40 }) telefono?:
    string | null;
  @Texto('N° cuenta', { opcional: true, max: 40 }) numeroCuenta?: string | null;
  @Texto('Banco', { opcional: true, max: 80, mayusculas: true }) banco?:
    string | null;
}

class FiltroConductores {
  @Id('Empresa', { opcional: true }) empresaId?: number;
  @Booleano('Solo activos', { opcional: true }) activos?: boolean;
}

const include = { empresa: true } satisfies Prisma.ConductorInclude;
type Fila = Prisma.ConductorGetPayload<{ include: typeof include }>;

function aDto(c: Fila): ConductorDto {
  return {
    id: c.id,
    rut: c.rut,
    nombre: c.nombre,
    activo: c.activo,
    tipo: c.tipo,
    empresaId: c.empresaId,
    empresa: c.empresa.razonSocial,
    comision: c.comision,
    numeroLicencia: c.numeroLicencia,
    vencLicencia: aIso(c.vencLicencia),
    fechaIngreso: aIso(c.fechaIngreso),
    terminoContrato: aIso(c.terminoContrato),
    direccion: c.direccion,
    telefono: c.telefono,
    numeroCuenta: c.numeroCuenta,
    banco: c.banco,
  };
}

@Injectable()
export class ConductoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
  ) {}

  async listar(f: FiltroConductores): Promise<ConductorDto[]> {
    const filas = await this.prisma.conductor.findMany({
      where: { empresaId: f.empresaId, ...(f.activos ? { activo: true } : {}) },
      include,
      orderBy: { nombre: 'asc' },
    });
    return filas.map(aDto);
  }

  async obtener(id: number): Promise<ConductorDto> {
    const c = await this.prisma.conductor.findUnique({
      where: { id },
      include,
    });
    if (!c) throw noEncontrado('El conductor');
    return aDto(c);
  }

  private datos(dto: ConductorDtoIn) {
    return {
      ...dto,
      vencLicencia: aFecha(dto.vencLicencia),
      fechaIngreso: aFecha(dto.fechaIngreso),
      terminoContrato: aFecha(dto.terminoContrato),
    };
  }

  async crear(dto: ConductorDtoIn, u: UsuarioSesion): Promise<ConductorDto> {
    exigirRutValido(dto.rut);
    return this.prisma.$transaction(async (tx) => {
      await this.refs.empresa(tx, dto.empresaId);
      const c = await tx.conductor.create({
        data: {
          ...this.datos(dto),
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Conductor',
        entidadId: c.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(c),
      });
      return aDto(c);
    });
  }

  async actualizar(
    id: number,
    dto: ConductorDtoIn,
    u: UsuarioSesion,
  ): Promise<ConductorDto> {
    const antes = await this.prisma.conductor.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El conductor');
    exigirRutValido(dto.rut, antes.rut);
    return this.prisma.$transaction(async (tx) => {
      await this.refs.empresa(tx, dto.empresaId, antes.empresaId);
      const c = await tx.conductor.update({
        where: { id },
        data: {
          ...this.datos(dto),
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Conductor',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, c),
      });
      return aDto(c);
    });
  }
}

@ApiTags('Mantenedores')
@Controller('conductores')
export class ConductoresController {
  constructor(private readonly servicio: ConductoresService) {}

  @Get() listar(@Query() f: FiltroConductores) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  crear(@Body() dto: ConductorDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConductorDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }
}

@Module({
  controllers: [ConductoresController],
  providers: [ConductoresService],
})
export class ConductoresModule {}
