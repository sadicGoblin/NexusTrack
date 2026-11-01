import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  generarTramo,
  hoyIso,
  type RutaTarifaDto,
  type RutaTarifaInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { invalido, enUso, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso } from '../comun/fechas.js';
import {
  Booleano,
  Decimal,
  Fecha,
  Id,
  Monto,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

class RutaTarifaDtoIn implements RutaTarifaInput {
  @Texto('Código', { opcional: true, max: 30, mayusculas: true }) codigo?:
    string | null;
  @Id('Cliente') clienteId!: number;
  @Id('Origen') origenId!: number;
  @Id('Destino') destinoId!: number;
  @Id('Unidad') unidadId!: number;
  @Decimal('Distancia', { opcional: true, min: 0, max: 10_000, decimales: 1 })
  distanciaKm?: number | null;
  @Monto('Valor', { positivo: true }) valor!: number;
  @Fecha('Vigencia desde', { opcional: true }) vigenciaDesde?: string | null;
  @Fecha('Vigencia hasta', { opcional: true }) vigenciaHasta?: string | null;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
}

class FiltroRutas {
  @Id('Cliente', { opcional: true }) clienteId?: number;
  @Fecha('Vigentes al', {
    opcional: true,
    descripcion: 'Solo tarifas activas y vigentes en esa fecha',
  })
  vigentesAl?: string;
  @Booleano('Solo activas', { opcional: true }) activas?: boolean;
}

export const includeRuta = {
  cliente: true,
  origen: true,
  destino: true,
  unidad: true,
} satisfies Prisma.RutaTarifaInclude;
type Fila = Prisma.RutaTarifaGetPayload<{ include: typeof includeRuta }>;

/** Una tarifa está vigente en una fecha si está activa y la fecha cae dentro de su vigencia. */
export function rutaVigente(
  r: {
    activo: boolean;
    vigenciaDesde: Date | null;
    vigenciaHasta: Date | null;
  },
  fecha: string,
): boolean {
  const desde = aIso(r.vigenciaDesde);
  const hasta = aIso(r.vigenciaHasta);
  return r.activo && (!desde || desde <= fecha) && (!hasta || hasta >= fecha);
}

export function aRutaDto(r: Fila): RutaTarifaDto {
  return {
    id: r.id,
    codigo: r.codigo,
    clienteId: r.clienteId,
    cliente: r.cliente.nombre,
    origenId: r.origenId,
    origen: r.origen.valor,
    destinoId: r.destinoId,
    destino: r.destino.valor,
    unidadId: r.unidadId,
    unidad: r.unidad.valor,
    tramo: r.tramo,
    distanciaKm: r.distanciaKm,
    valor: r.valor,
    vigenciaDesde: aIso(r.vigenciaDesde),
    vigenciaHasta: aIso(r.vigenciaHasta),
    activo: r.activo,
    vigente: rutaVigente(r, hoyIso()),
  };
}

@Injectable()
export class RutasTarifasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
  ) {}

  async listar(f: FiltroRutas): Promise<RutaTarifaDto[]> {
    const fecha = f.vigentesAl ? aFecha(f.vigentesAl)! : undefined;
    const filas = await this.prisma.rutaTarifa.findMany({
      where: {
        clienteId: f.clienteId,
        ...(f.activas || fecha ? { activo: true } : {}),
        ...(fecha
          ? {
              AND: [
                {
                  OR: [
                    { vigenciaDesde: null },
                    { vigenciaDesde: { lte: fecha } },
                  ],
                },
                {
                  OR: [
                    { vigenciaHasta: null },
                    { vigenciaHasta: { gte: fecha } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: includeRuta,
      orderBy: [{ cliente: { nombre: 'asc' } }, { tramo: 'asc' }],
    });
    return filas.map(aRutaDto);
  }

  async obtener(id: number): Promise<RutaTarifaDto> {
    const r = await this.prisma.rutaTarifa.findUnique({
      where: { id },
      include: includeRuta,
    });
    if (!r) throw noEncontrado('La ruta tarifa');
    return aRutaDto(r);
  }

  private validarVigencia(dto: RutaTarifaDtoIn) {
    if (
      dto.vigenciaDesde &&
      dto.vigenciaHasta &&
      dto.vigenciaDesde > dto.vigenciaHasta
    ) {
      throw invalido(
        'La vigencia desde no puede ser posterior a la vigencia hasta.',
      );
    }
  }

  async crear(dto: RutaTarifaDtoIn, u: UsuarioSesion): Promise<RutaTarifaDto> {
    this.validarVigencia(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.refs.cliente(tx, dto.clienteId);
      const origen = await this.refs.catalogo(
        tx,
        dto.origenId,
        'CIUDAD',
        'Origen',
      );
      const destino = await this.refs.catalogo(
        tx,
        dto.destinoId,
        'CIUDAD',
        'Destino',
      );
      const unidad = await this.refs.catalogo(
        tx,
        dto.unidadId,
        'UNIDAD_RUTA',
        'Unidad',
      );
      const codigo =
        dto.codigo ||
        (await this.secuencias.siguienteCodigo(tx, 'RUTA_TARIFA', 'RT'));
      const r = await tx.rutaTarifa.create({
        data: {
          ...dto,
          codigo,
          tramo: generarTramo(origen.valor, destino.valor, unidad.valor),
          vigenciaDesde: aFecha(dto.vigenciaDesde),
          vigenciaHasta: aFecha(dto.vigenciaHasta),
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include: includeRuta,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'RutaTarifa',
        entidadId: r.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(r),
      });
      return aRutaDto(r);
    });
  }

  async actualizar(
    id: number,
    dto: RutaTarifaDtoIn,
    u: UsuarioSesion,
  ): Promise<RutaTarifaDto> {
    this.validarVigencia(dto);
    const antes = await this.prisma.rutaTarifa.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('La ruta tarifa');
    return this.prisma.$transaction(async (tx) => {
      await this.refs.cliente(tx, dto.clienteId, antes.clienteId);
      const origen = await this.refs.catalogo(
        tx,
        dto.origenId,
        'CIUDAD',
        'Origen',
        antes.origenId,
      );
      const destino = await this.refs.catalogo(
        tx,
        dto.destinoId,
        'CIUDAD',
        'Destino',
        antes.destinoId,
      );
      const unidad = await this.refs.catalogo(
        tx,
        dto.unidadId,
        'UNIDAD_RUTA',
        'Unidad',
        antes.unidadId,
      );
      const r = await tx.rutaTarifa.update({
        where: { id },
        data: {
          ...dto,
          codigo: dto.codigo || antes.codigo,
          tramo: generarTramo(origen.valor, destino.valor, unidad.valor),
          vigenciaDesde: aFecha(dto.vigenciaDesde),
          vigenciaHasta: aFecha(dto.vigenciaHasta),
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
        include: includeRuta,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'RutaTarifa',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, r),
      });
      return aRutaDto(r);
    });
  }
  /** Solo si nada lo usa; si no, el registro se desactiva. */
  async eliminar(id: number, u: UsuarioSesion): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.rutaTarifa.findUnique({ where: { id } });
      if (!r) throw noEncontrado('La ruta tarifa');
      await tx.rutaTarifa
        .delete({ where: { id } })
        .catch((e: unknown) =>
          enUso(
            e,
            'No se puede eliminar la tarifa: hay órdenes de carga que la usan. Si ya no rige, desactívela.',
          ),
        );
      await this.auditoria.registrar(tx, {
        entidad: 'RutaTarifa',
        entidadId: id,
        accion: 'ELIMINAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(r),
      });
    });
  }
}

@ApiTags('Mantenedores')
@Controller('rutas-tarifas')
export class RutasTarifasController {
  constructor(private readonly servicio: RutasTarifasService) {}

  @Get() listar(@Query() f: FiltroRutas) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarTarifas')
  @Post()
  crear(@Body() dto: RutaTarifaDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarTarifas')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RutaTarifaDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }

  @RequierePermiso('eliminar')
  @Delete(':id')
  @HttpCode(204)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.eliminar(id, u);
  }
}

@Module({
  controllers: [RutasTarifasController],
  providers: [RutasTarifasService],
})
export class RutasTarifasModule {}
