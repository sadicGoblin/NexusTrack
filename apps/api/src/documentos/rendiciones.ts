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
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  calcularRendicion,
  EstadoDocumento,
  totalViatico,
  type FormatoExportacion,
  type GastoInput,
  type RendicionDto,
  type RendicionInput,
  type UsuarioSesion,
  type ViaticoInput,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { AnularDto, FiltroFechasDto } from '../comun/dto.js';
import {
  conflicto,
  exigirRutValido,
  invalido,
  noEncontrado,
} from '../comun/errores.js';
import { aFecha, aIso, rangoFechas } from '../comun/fechas.js';
import {
  Entero,
  Fecha,
  Hora,
  Id,
  Lista,
  Monto,
  Opcion,
  Rut,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { Prisma, Rendicion } from '../generated/prisma/client.js';
import {
  aResumenRetiro,
  etiquetaEstado,
  includeRetiro,
  seccionRetiro,
} from './retiro.mapper.js';

class ViaticoDtoIn implements ViaticoInput {
  @Fecha('Fecha del viático') fecha!: string;
  @Monto('Desayuno', { opcional: true }) desayuno?: number | null;
  @Monto('Almuerzo', { opcional: true }) almuerzo?: number | null;
  @Monto('Comida', { opcional: true }) comida?: number | null;
}

class GastoDtoIn implements GastoInput {
  @Id('Tipo de documento', { opcional: true }) tipoDocumentoId?: number | null;
  @Texto('N° documento', { opcional: true, max: 40, mayusculas: true })
  numeroDocumento?: string | null;
  @Rut('RUT proveedor', { opcional: true }) rutProveedor?: string | null;
  @Fecha('Fecha del gasto', { opcional: true }) fecha?: string | null;
  @Monto('Monto del gasto', { positivo: true }) monto!: number;
  @Id('Ítem de gasto', { opcional: true }) itemGastoId?: number | null;
  @Texto('Observaciones del gasto', { opcional: true, max: 300 })
  observaciones?: string | null;
}

class RendicionDtoIn implements RendicionInput {
  @Id('Orden de carga') ordenCargaId!: number;
  @Fecha('Fecha de rendición') fecha!: string;
  @Fecha('Fecha de salida', { opcional: true }) fechaSalida?: string | null;
  @Hora('Hora de salida', { opcional: true }) horaSalida?: string | null;
  @Fecha('Fecha de llegada', { opcional: true }) fechaLlegada?: string | null;
  @Hora('Hora de llegada', { opcional: true }) horaLlegada?: string | null;
  @Entero('Odómetro inicial', { opcional: true, min: 0, max: 99_999_999 })
  odometroInicial?: number | null;
  @Entero('Odómetro final', { opcional: true, min: 0, max: 99_999_999 })
  odometroFinal?: number | null;
  @Texto('Observaciones', { opcional: true, max: 1000 }) observaciones?:
    string | null;
  @Fecha('Fecha de entrega', { opcional: true }) fechaEntrega?: string | null;
  @Id('Sitio de entrega', { opcional: true }) sitioEntregaId?: number | null;
  @Monto('Peajes', { opcional: true }) peajes?: number | null;
  @Monto('Carga', { opcional: true }) carga?: number | null;
  @Monto('Descarga', { opcional: true }) descarga?: number | null;
  @Lista('Viáticos', () => ViaticoDtoIn, { max: 60 }) viaticos!: ViaticoDtoIn[];
  @Lista('Otros gastos', () => GastoDtoIn, { max: 200 }) gastos!: GastoDtoIn[];
}

class FiltroRendiciones extends FiltroFechasDto {
  @Opcion('Estado', Object.values(EstadoDocumento), { opcional: true })
  estado?: EstadoDocumento;
}

const include = {
  sitioEntrega: true,
  ordenCarga: {
    include: {
      tramo: true,
      packingCarga: true,
      ordenRetiro: { include: includeRetiro },
    },
  },
  viaticos: { orderBy: { linea: 'asc' } },
  gastos: {
    include: { tipoDocumento: true, itemGasto: true },
    orderBy: { linea: 'asc' },
  },
} satisfies Prisma.RendicionInclude;
type Fila = Prisma.RendicionGetPayload<{ include: typeof include }>;

function aDto(r: Fila): RendicionDto {
  const oc = r.ordenCarga;
  return {
    id: r.id,
    numero: r.numero,
    estado: r.estado,
    ordenCargaId: r.ordenCargaId,
    ordenCargaNumero: oc.numero,
    tramo: oc.tramo?.tramo ?? null,
    fechaCarga: aIso(oc.fechaCarga)!,
    horaCarga: oc.horaCarga,
    packingCarga: oc.packingCarga?.nombre ?? null,
    patenteCamion: oc.patenteCamion,
    patenteRemolque: oc.patenteRemolque,
    fecha: aIso(r.fecha)!,
    fechaSalida: aIso(r.fechaSalida),
    horaSalida: r.horaSalida,
    fechaLlegada: aIso(r.fechaLlegada),
    horaLlegada: r.horaLlegada,
    odometroInicial: r.odometroInicial,
    odometroFinal: r.odometroFinal,
    kmRecorridos: r.kmRecorridos,
    observaciones: r.observaciones,
    fechaEntrega: aIso(r.fechaEntrega),
    sitioEntregaId: r.sitioEntregaId,
    sitioEntrega: r.sitioEntrega?.valor ?? null,
    peajes: r.peajes,
    carga: r.carga,
    descarga: r.descarga,
    totalViaticos: r.totalViaticos,
    totalOtrosGastos: r.totalOtrosGastos,
    totalGeneral: r.totalGeneral,
    motivoAnulacion: r.motivoAnulacion,
    viaticos: r.viaticos.map((v) => ({
      id: v.id,
      fecha: aIso(v.fecha)!,
      desayuno: v.desayuno,
      almuerzo: v.almuerzo,
      comida: v.comida,
      total: v.total,
    })),
    gastos: r.gastos.map((g) => ({
      id: g.id,
      tipoDocumentoId: g.tipoDocumentoId,
      tipoDocumento: g.tipoDocumento?.valor ?? null,
      numeroDocumento: g.numeroDocumento,
      rutProveedor: g.rutProveedor,
      fecha: aIso(g.fecha),
      monto: g.monto,
      itemGastoId: g.itemGastoId,
      itemGasto: g.itemGasto?.valor ?? null,
      observaciones: g.observaciones,
    })),
    retiro: aResumenRetiro(oc.ordenRetiro),
  };
}

@Injectable()
export class RendicionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroRendiciones): Promise<RendicionDto[]> {
    const filas = await this.prisma.rendicion.findMany({
      where: { fecha: rangoFechas(f.desde, f.hasta), estado: f.estado },
      include,
      orderBy: { numero: 'desc' },
      take: 5000,
    });
    return filas.map(aDto);
  }

  async obtener(id: number): Promise<RendicionDto> {
    const r = await this.prisma.rendicion.findUnique({
      where: { id },
      include,
    });
    if (!r) throw noEncontrado('La rendición');
    return aDto(r);
  }

  private async preparar(tx: Tx, dto: RendicionDtoIn, antes?: Rendicion) {
    if (
      dto.odometroInicial != null &&
      dto.odometroFinal != null &&
      dto.odometroFinal < dto.odometroInicial
    ) {
      throw invalido('El odómetro final no puede ser menor que el inicial.');
    }
    if (dto.fechaSalida && dto.fechaLlegada) {
      const salida = `${dto.fechaSalida} ${dto.horaSalida ?? '00:00'}`;
      const llegada = `${dto.fechaLlegada} ${dto.horaLlegada ?? '23:59'}`;
      if (llegada < salida)
        throw invalido('La llegada no puede ser anterior a la salida.');
    }
    await this.refs.catalogoOpcional(
      tx,
      dto.sitioEntregaId,
      'SITIO_ENTREGA',
      'Sitio de entrega',
      antes?.sitioEntregaId,
    );
    for (const [i, g] of dto.gastos.entries()) {
      await this.refs.catalogoOpcional(
        tx,
        g.tipoDocumentoId,
        'TIPO_DOCUMENTO',
        `Gasto línea ${i + 1}, tipo de documento`,
      );
      await this.refs.catalogoOpcional(
        tx,
        g.itemGastoId,
        'ITEM_GASTO',
        `Gasto línea ${i + 1}, ítem`,
      );
      if (g.rutProveedor) exigirRutValido(g.rutProveedor);
    }
    const totales = calcularRendicion(dto);
    return {
      datos: {
        fecha: aFecha(dto.fecha)!,
        fechaSalida: aFecha(dto.fechaSalida),
        horaSalida: dto.horaSalida ?? null,
        fechaLlegada: aFecha(dto.fechaLlegada),
        horaLlegada: dto.horaLlegada ?? null,
        odometroInicial: dto.odometroInicial ?? null,
        odometroFinal: dto.odometroFinal ?? null,
        observaciones: dto.observaciones ?? null,
        fechaEntrega: aFecha(dto.fechaEntrega),
        sitioEntregaId: dto.sitioEntregaId ?? null,
        peajes: dto.peajes ?? 0,
        carga: dto.carga ?? 0,
        descarga: dto.descarga ?? 0,
        ...totales,
      },
      viaticos: dto.viaticos.map((v, i) => ({
        linea: i + 1,
        fecha: aFecha(v.fecha)!,
        desayuno: v.desayuno ?? 0,
        almuerzo: v.almuerzo ?? 0,
        comida: v.comida ?? 0,
        total: totalViatico(v),
      })),
      gastos: dto.gastos.map((g, i) => ({
        linea: i + 1,
        tipoDocumentoId: g.tipoDocumentoId ?? null,
        numeroDocumento: g.numeroDocumento ?? null,
        rutProveedor: g.rutProveedor ?? null,
        fecha: aFecha(g.fecha),
        monto: g.monto,
        itemGastoId: g.itemGastoId ?? null,
        observaciones: g.observaciones ?? null,
      })),
    };
  }

  async crear(dto: RendicionDtoIn, u: UsuarioSesion): Promise<RendicionDto> {
    return this.prisma.$transaction(async (tx) => {
      const carga = await tx.ordenCarga.findUnique({
        where: { id: dto.ordenCargaId },
      });
      if (!carga) throw invalido('La orden de carga seleccionada no existe.');
      if (carga.estado !== 'ABIERTA') {
        throw conflicto(
          `La orden de carga N° ${carga.numero} no admite rendición (${etiquetaEstado(carga.estado).toLowerCase()}).`,
        );
      }
      if (!carga.hojaRuta)
        throw conflicto(
          `Registre las guías de la orden de carga N° ${carga.numero} antes de rendir.`,
        );
      const { datos, viaticos, gastos } = await this.preparar(tx, dto);
      const numero = await this.secuencias.siguiente(tx, 'RENDICION');
      const r = await tx.rendicion.create({
        data: {
          ...datos,
          numero,
          ordenCargaId: carga.id,
          viaticos: { createMany: { data: viaticos } },
          gastos: { createMany: { data: gastos } },
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await tx.ordenCarga.update({
        where: { id: carga.id },
        data: { estado: 'RENDIDA', actualizadoPorId: u.id },
      });
      await tx.ordenRetiro.update({
        where: { id: carga.ordenRetiroId },
        data: { estado: 'CERRADA', actualizadoPorId: u.id },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Rendicion',
        entidadId: r.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: {
          ...this.auditoria.instantanea(r),
          viaticos: viaticos.length,
          gastos: gastos.length,
        },
      });
      return this.obtenerTx(tx, r.id);
    });
  }

  private async obtenerTx(tx: Tx, id: number): Promise<RendicionDto> {
    return aDto(
      await tx.rendicion.findUniqueOrThrow({ where: { id }, include }),
    );
  }

  async actualizar(
    id: number,
    dto: RendicionDtoIn,
    u: UsuarioSesion,
  ): Promise<RendicionDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.rendicion.findUnique({ where: { id } });
      if (!antes) throw noEncontrado('La rendición');
      if (antes.estado === 'ANULADO')
        throw conflicto('La rendición está anulada y no se puede modificar.');
      if (dto.ordenCargaId !== antes.ordenCargaId)
        throw invalido(
          'No se puede cambiar la orden de carga de una rendición.',
        );
      const { datos, viaticos, gastos } = await this.preparar(tx, dto, antes);
      await tx.rendicionViatico.deleteMany({ where: { rendicionId: id } });
      await tx.rendicionGasto.deleteMany({ where: { rendicionId: id } });
      const r = await tx.rendicion.update({
        where: { id },
        data: {
          ...datos,
          viaticos: { createMany: { data: viaticos } },
          gastos: { createMany: { data: gastos } },
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Rendicion',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, r),
      });
      return aDto(r);
    });
  }

  async anular(
    id: number,
    motivo: string,
    u: UsuarioSesion,
  ): Promise<RendicionDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.rendicion.findUnique({
        where: { id },
        include: { ordenCarga: true },
      });
      if (!antes) throw noEncontrado('La rendición');
      if (antes.estado === 'ANULADO')
        throw conflicto('La rendición ya está anulada.');
      await tx.rendicion.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          motivoAnulacion: motivo,
          anuladoEn: new Date(),
          actualizadoPorId: u.id,
        },
      });
      await tx.ordenCarga.update({
        where: { id: antes.ordenCargaId },
        data: { estado: 'ABIERTA', actualizadoPorId: u.id },
      });
      await tx.ordenRetiro.update({
        where: { id: antes.ordenCarga.ordenRetiroId },
        data: { estado: 'CON_CARGA', actualizadoPorId: u.id },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Rendicion',
        entidadId: id,
        accion: 'ANULAR',
        usuarioId: u.id,
        cambios: { motivo },
      });
      return this.obtenerTx(tx, id);
    });
  }

  async exportar(id: number, formato: FormatoExportacion) {
    const r = await this.obtener(id);
    return this.exportacion.documento(
      {
        titulo: 'Rendición de Fletes',
        numero: r.numero,
        fecha: r.fecha,
        estado: etiquetaEstado(r.estado),
        anulado:
          r.estado === 'ANULADO' ? { motivo: r.motivoAnulacion } : undefined,
        nombreArchivo: `rendicion-${String(r.numero).padStart(6, '0')}`,
        secciones: [
          {
            titulo: `Orden de carga N° ${String(r.ordenCargaNumero).padStart(6, '0')}`,
            campos: [
              { etiqueta: 'Tramo', valor: r.tramo, ancho: 2 },
              {
                etiqueta: 'Fecha de carga',
                valor: r.fechaCarga,
                tipo: 'fecha',
              },
              { etiqueta: 'Hora de carga', valor: r.horaCarga },
              { etiqueta: 'Packing de carga', valor: r.packingCarga, ancho: 2 },
              { etiqueta: 'Patente camión', valor: r.patenteCamion },
              { etiqueta: 'Patente remolque', valor: r.patenteRemolque },
            ],
          },
          seccionRetiro(r.retiro),
          {
            titulo: 'Viaje',
            campos: [
              {
                etiqueta: 'Salida',
                valor: [
                  r.fechaSalida?.split('-').reverse().join('/'),
                  r.horaSalida,
                ]
                  .filter(Boolean)
                  .join(' '),
              },
              {
                etiqueta: 'Llegada',
                valor: [
                  r.fechaLlegada?.split('-').reverse().join('/'),
                  r.horaLlegada,
                ]
                  .filter(Boolean)
                  .join(' '),
              },
              {
                etiqueta: 'Odómetro inicial',
                valor: r.odometroInicial,
                tipo: 'numero',
              },
              {
                etiqueta: 'Odómetro final',
                valor: r.odometroFinal,
                tipo: 'numero',
              },
              {
                etiqueta: 'Kilómetros recorridos',
                valor: r.kmRecorridos,
                tipo: 'numero',
              },
              {
                etiqueta: 'Fecha de entrega',
                valor: r.fechaEntrega,
                tipo: 'fecha',
              },
              { etiqueta: 'Sitio de entrega', valor: r.sitioEntrega, ancho: 2 },
            ],
          },
          {
            titulo: 'Detalle de gastos',
            campos: [
              { etiqueta: 'Peajes', valor: r.peajes, tipo: 'pesos' },
              { etiqueta: 'Carga', valor: r.carga, tipo: 'pesos' },
              { etiqueta: 'Descarga', valor: r.descarga, tipo: 'pesos' },
            ],
          },
        ],
        tablas: [
          {
            titulo: 'Viáticos',
            columnas: [
              { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
              { campo: 'desayuno', titulo: 'Desayuno', tipo: 'pesos' },
              { campo: 'almuerzo', titulo: 'Almuerzo', tipo: 'pesos' },
              { campo: 'comida', titulo: 'Comida', tipo: 'pesos' },
              { campo: 'total', titulo: 'Total', tipo: 'pesos' },
            ],
            filas: r.viaticos as unknown as Record<string, unknown>[],
            totales: [
              {
                etiqueta: 'Total viáticos',
                valor: r.totalViaticos,
                tipo: 'pesos',
              },
            ],
          },
          {
            titulo: 'Otros gastos',
            columnas: [
              { campo: 'tipoDocumento', titulo: 'Tipo documento' },
              { campo: 'numeroDocumento', titulo: 'N° documento' },
              { campo: 'rutProveedor', titulo: 'RUT proveedor' },
              { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
              { campo: 'itemGasto', titulo: 'Ítem' },
              { campo: 'observaciones', titulo: 'Observaciones' },
              { campo: 'monto', titulo: 'Monto', tipo: 'pesos' },
            ],
            filas: r.gastos as unknown as Record<string, unknown>[],
            totales: [
              {
                etiqueta: 'Total otros gastos',
                valor: r.totalOtrosGastos,
                tipo: 'pesos',
              },
              {
                etiqueta: 'Total rendición',
                valor: r.totalGeneral,
                tipo: 'pesos',
              },
            ],
          },
        ],
        observaciones: r.observaciones,
        firmas: ['Firma conductor', 'Revisado por'],
      },
      formato,
    );
  }
}

@ApiTags('Documentos')
@Controller('rendiciones')
export class RendicionesController {
  constructor(private readonly servicio: RendicionesService) {}

  @Get() listar(@Query() f: FiltroRendiciones) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Get(':id/pdf') async pdf(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'pdf'));
  }

  @Get(':id/xlsx') async xlsx(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'xlsx'));
  }

  @RequierePermiso('editarFinanzas')
  @Post()
  crear(@Body() dto: RendicionDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarFinanzas')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RendicionDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }

  @RequierePermiso('anular')
  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularDto,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.anular(id, dto.motivo, u);
  }
}

@Module({
  controllers: [RendicionesController],
  providers: [RendicionesService],
})
export class RendicionesModule {}
