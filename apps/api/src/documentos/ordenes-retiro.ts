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
  EstadoOrdenRetiro,
  type FormatoExportacion,
  type OrdenRetiroDto,
  type OrdenRetiroInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { AnularDto, FiltroFechasDto } from '../comun/dto.js';
import { conflicto, noEncontrado } from '../comun/errores.js';
import { aFecha, rangoFechas } from '../comun/fechas.js';
import {
  Booleano,
  Fecha,
  Hora,
  Id,
  Opcion,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { DocumentoImprimible } from '../exportacion/tipos.js';
import type { OrdenRetiro } from '../generated/prisma/client.js';
import {
  aOrdenRetiroDto,
  etiquetaEstado,
  includeRetiro,
} from './retiro.mapper.js';

class OrdenRetiroDtoIn implements OrdenRetiroInput {
  @Fecha('Fecha de orden de retiro') fecha!: string;
  @Id('Trazabilidad') trazabilidadId!: number;
  @Id('Conductor') conductorId!: number;
  @Id('Patente camión') camionId!: number;
  @Id('Patente remolque', { opcional: true }) remolqueId?: number | null;
  @Id('Empresa') empresaId!: number;
  @Id('Cliente') clienteId!: number;
  @Id('Origen') origenId!: number;
  @Id('Destino') destinoId!: number;
  @Id('Depósito de retiro', { opcional: true }) depositoRetiroId?:
    number | null;
  @Id('Packing de carga', { opcional: true }) packingCargaId?: number | null;
  @Fecha('Fecha de carga', { opcional: true }) fechaCarga?: string | null;
  @Hora('Hora de carga', { opcional: true }) horaCarga?: string | null;
  @Id('Depósito de entrega', { opcional: true }) depositoEntregaId?:
    number | null;
  @Id('Packing de entrega', { opcional: true }) packingEntregaId?:
    number | null;
  @Texto('Destino final', { opcional: true, max: 150, mayusculas: true })
  destinoFinal?: string | null;
  @Texto('Nave', { opcional: true, max: 100, mayusculas: true }) nave?:
    string | null;
  @Texto('MTB', { opcional: true, max: 60, mayusculas: true }) mtb?:
    string | null;
  @Texto('Booking', { opcional: true, max: 60, mayusculas: true }) booking?:
    string | null;
  @Id('Puerto de embarque', { opcional: true }) puertoEmbarqueId?:
    number | null;
  @Fecha('Fecha de embarque', { opcional: true }) fechaEmbarque?: string | null;
  @Hora('Hora de embarque', { opcional: true }) horaEmbarque?: string | null;
  @Texto('OP N°', { opcional: true, max: 40, mayusculas: true }) opNumero?:
    string | null;
  @Texto('O/C', { opcional: true, max: 40, mayusculas: true }) ordenCompra?:
    string | null;
  @Texto('Observaciones', { opcional: true, max: 1000 }) observaciones?:
    string | null;
}

class FiltroRetiros extends FiltroFechasDto {
  @Opcion('Estado', Object.values(EstadoOrdenRetiro), { opcional: true })
  estado?: EstadoOrdenRetiro;
  @Booleano('Solo activas', {
    opcional: true,
    descripcion: 'Abiertas o con carga: admiten vales',
  })
  activas?: boolean;
  @Booleano('Sin orden de carga', {
    opcional: true,
    descripcion: 'Abiertas: admiten orden de carga',
  })
  sinCarga?: boolean;
  @Id('Cliente', { opcional: true }) clienteId?: number;
}

const EDITABLES: EstadoOrdenRetiro[] = ['ABIERTA', 'CON_CARGA'];

@Injectable()
export class OrdenesRetiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroRetiros): Promise<OrdenRetiroDto[]> {
    const estados: EstadoOrdenRetiro[] | undefined = f.sinCarga
      ? ['ABIERTA']
      : f.activas
        ? EDITABLES
        : f.estado
          ? [f.estado]
          : undefined;
    const filas = await this.prisma.ordenRetiro.findMany({
      where: {
        fecha: rangoFechas(f.desde, f.hasta),
        clienteId: f.clienteId,
        ...(estados ? { estado: { in: estados } } : {}),
      },
      include: includeRetiro,
      orderBy: { numero: 'desc' },
      take: 5000,
    });
    return filas.map(aOrdenRetiroDto);
  }

  async obtener(id: number): Promise<OrdenRetiroDto> {
    const o = await this.prisma.ordenRetiro.findUnique({
      where: { id },
      include: includeRetiro,
    });
    if (!o) throw noEncontrado('La orden de retiro');
    return aOrdenRetiroDto(o);
  }

  /** Valida todas las referencias y arma los datos a guardar. */
  private async preparar(tx: Tx, dto: OrdenRetiroDtoIn, antes?: OrdenRetiro) {
    await this.refs.catalogo(
      tx,
      dto.trazabilidadId,
      'TRAZABILIDAD',
      'Trazabilidad',
      antes?.trazabilidadId,
    );
    await this.refs.conductor(tx, dto.conductorId, antes?.conductorId);
    await this.refs.movil(
      tx,
      dto.camionId,
      ['camion'],
      'Patente camión',
      antes?.camionId,
    );
    const remolque = await this.refs.movil(
      tx,
      dto.remolqueId,
      ['chasis', 'thermo', 'plataforma'],
      'Patente remolque',
      antes?.remolqueId,
    );
    await this.refs.empresa(tx, dto.empresaId, antes?.empresaId);
    await this.refs.cliente(tx, dto.clienteId, antes?.clienteId);
    await this.refs.catalogo(
      tx,
      dto.origenId,
      'CIUDAD',
      'Origen',
      antes?.origenId,
    );
    await this.refs.catalogo(
      tx,
      dto.destinoId,
      'CIUDAD',
      'Destino',
      antes?.destinoId,
    );
    await this.refs.catalogoOpcional(
      tx,
      dto.depositoRetiroId,
      'DEPOSITO',
      'Depósito de retiro',
      antes?.depositoRetiroId,
    );
    await this.refs.catalogoOpcional(
      tx,
      dto.depositoEntregaId,
      'DEPOSITO',
      'Depósito de entrega',
      antes?.depositoEntregaId,
    );
    await this.refs.catalogoOpcional(
      tx,
      dto.puertoEmbarqueId,
      'PUERTO_EMBARQUE',
      'Puerto de embarque',
      antes?.puertoEmbarqueId,
    );
    await this.refs.packing(
      tx,
      dto.packingCargaId,
      'Packing de carga',
      antes?.packingCargaId,
    );
    await this.refs.packing(
      tx,
      dto.packingEntregaId,
      'Packing de entrega',
      antes?.packingEntregaId,
    );
    return {
      ...dto,
      remolqueId: dto.remolqueId ?? null,
      tipoRemolque: remolque?.tipo.valor ?? null,
      fecha: aFecha(dto.fecha)!,
      fechaCarga: aFecha(dto.fechaCarga),
      fechaEmbarque: aFecha(dto.fechaEmbarque),
    };
  }

  async crear(
    dto: OrdenRetiroDtoIn,
    u: UsuarioSesion,
  ): Promise<OrdenRetiroDto> {
    return this.prisma.$transaction(async (tx) => {
      const datos = await this.preparar(tx, dto);
      const numero = await this.secuencias.siguiente(tx, 'ORDEN_RETIRO');
      const o = await tx.ordenRetiro.create({
        data: {
          ...datos,
          numero,
          estado: 'ABIERTA',
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include: includeRetiro,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenRetiro',
        entidadId: o.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(o),
      });
      return aOrdenRetiroDto(o);
    });
  }

  async actualizar(
    id: number,
    dto: OrdenRetiroDtoIn,
    u: UsuarioSesion,
  ): Promise<OrdenRetiroDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.ordenRetiro.findUnique({
        where: { id },
        include: { ordenesCarga: { where: { estado: { not: 'ANULADA' } } } },
      });
      if (!antes) throw noEncontrado('La orden de retiro');
      if (!EDITABLES.includes(antes.estado)) {
        throw conflicto(
          `La orden de retiro está ${etiquetaEstado(antes.estado).toLowerCase()} y no se puede modificar.`,
        );
      }
      if (antes.ordenesCarga.length && dto.clienteId !== antes.clienteId) {
        throw conflicto(
          `No se puede cambiar el cliente: la orden ya tiene la orden de carga N° ${antes.ordenesCarga[0].numero}.`,
        );
      }
      const datos = await this.preparar(tx, dto, antes);
      const o = await tx.ordenRetiro.update({
        where: { id },
        data: { ...datos, actualizadoPorId: u.id },
        include: includeRetiro,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenRetiro',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, o),
      });
      return aOrdenRetiroDto(o);
    });
  }

  async anular(
    id: number,
    motivo: string,
    u: UsuarioSesion,
  ): Promise<OrdenRetiroDto> {
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.ordenRetiro.findUnique({
        where: { id },
        include: includeRetiro,
      });
      if (!o) throw noEncontrado('La orden de retiro');
      if (o.estado === 'ANULADA')
        throw conflicto('La orden de retiro ya está anulada.');
      if (o.ordenesCarga.length)
        throw conflicto(
          `Anule primero la orden de carga N° ${o.ordenesCarga[0].numero}.`,
        );
      if (o._count.valesDinero || o._count.valesCombustible) {
        throw conflicto(
          'La orden tiene vales de dinero o de combustible emitidos: anúlelos primero.',
        );
      }
      const anulada = await tx.ordenRetiro.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          motivoAnulacion: motivo,
          anuladoEn: new Date(),
          actualizadoPorId: u.id,
        },
        include: includeRetiro,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenRetiro',
        entidadId: id,
        accion: 'ANULAR',
        usuarioId: u.id,
        cambios: { motivo },
      });
      return aOrdenRetiroDto(anulada);
    });
  }

  async exportar(id: number, formato: FormatoExportacion) {
    const o = await this.obtener(id);
    const doc: DocumentoImprimible = {
      titulo: 'Orden de Retiro',
      numero: o.numero,
      fecha: o.fecha,
      estado: etiquetaEstado(o.estado),
      anulado:
        o.estado === 'ANULADA' ? { motivo: o.motivoAnulacion } : undefined,
      nombreArchivo: `orden-retiro-${String(o.numero).padStart(6, '0')}`,
      secciones: [
        {
          titulo: 'Flete',
          campos: [
            { etiqueta: 'Cliente', valor: o.cliente, ancho: 2 },
            { etiqueta: 'RUT cliente', valor: o.clienteRut },
            { etiqueta: 'Trazabilidad', valor: o.trazabilidad },
            { etiqueta: 'Origen', valor: o.origen },
            { etiqueta: 'Destino', valor: o.destino },
            { etiqueta: 'Destino final', valor: o.destinoFinal, ancho: 2 },
          ],
        },
        {
          titulo: 'Transporte',
          campos: [
            { etiqueta: 'Conductor', valor: o.conductor, ancho: 2 },
            { etiqueta: 'RUT conductor', valor: o.conductorRut },
            { etiqueta: 'Patente camión', valor: o.camion },
            { etiqueta: 'Empresa', valor: o.empresa, ancho: 2 },
            { etiqueta: 'Patente remolque', valor: o.remolque },
            { etiqueta: 'Tipo remolque', valor: o.tipoRemolque },
          ],
        },
        {
          titulo: 'Retiro y carga',
          campos: [
            {
              etiqueta: 'Depósito de retiro',
              valor: o.depositoRetiro,
              ancho: 2,
            },
            { etiqueta: 'Packing de carga', valor: o.packingCarga },
            {
              etiqueta: 'Fecha y hora de carga',
              valor: [
                o.fechaCarga && o.fechaCarga.split('-').reverse().join('/'),
                o.horaCarga,
              ]
                .filter(Boolean)
                .join(' '),
            },
            {
              etiqueta: 'Depósito de entrega',
              valor: o.depositoEntrega,
              ancho: 2,
            },
            {
              etiqueta: 'Packing de entrega',
              valor: o.packingEntrega,
              ancho: 2,
            },
          ],
        },
        {
          titulo: 'Embarque',
          campos: [
            { etiqueta: 'Nave', valor: o.nave },
            { etiqueta: 'MTB', valor: o.mtb },
            { etiqueta: 'Booking', valor: o.booking },
            { etiqueta: 'Puerto de embarque', valor: o.puertoEmbarque },
            {
              etiqueta: 'Fecha de embarque',
              valor: o.fechaEmbarque,
              tipo: 'fecha',
            },
            { etiqueta: 'Hora de embarque', valor: o.horaEmbarque },
            { etiqueta: 'OP N°', valor: o.opNumero },
            { etiqueta: 'O/C', valor: o.ordenCompra },
          ],
        },
      ],
      tablas: [],
      observaciones: o.observaciones,
      firmas: ['Firma conductor', 'Firma responsable'],
    };
    return this.exportacion.documento(doc, formato);
  }
}

@ApiTags('Documentos')
@Controller('ordenes-retiro')
export class OrdenesRetiroController {
  constructor(private readonly servicio: OrdenesRetiroService) {}

  @Get() listar(@Query() f: FiltroRetiros) {
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

  @RequierePermiso('editarOperacion')
  @Post()
  crear(@Body() dto: OrdenRetiroDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarOperacion')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OrdenRetiroDtoIn,
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
  controllers: [OrdenesRetiroController],
  providers: [OrdenesRetiroService],
})
export class OrdenesRetiroModule {}
